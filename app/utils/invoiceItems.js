// Shared helpers for invoice line items, their optional sub-items and extras.
//
// Item shape (stored in invoice.data.items):
//   { itemName, description, quantity, rate,
//     subItems?: [{ itemName, description, quantity, rate }],
//     extras?:   [{ name, description, price }] }
//
// When an item has sub-items, it acts as a group: its base amount is the sum of
// its sub-items' amounts, and its own quantity/rate are ignored.
// Extras are paid add-ons on top of an item (e.g. "Extra revision", with a
// description of what changed). An item's amount = base amount + its extras.

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const getSubItems = (item) =>
  Array.isArray(item?.subItems) ? item.subItems : [];

export const hasSubItems = (item) => getSubItems(item).length > 0;

export const calculateLineAmount = (line) =>
  toNumber(line?.quantity) * toNumber(line?.rate);

export const getExtras = (item) => (Array.isArray(item?.extras) ? item.extras : []);

export const hasExtras = (item) => getExtras(item).length > 0;

export const calculateExtrasTotal = (item) =>
  getExtras(item).reduce((sum, extra) => sum + toNumber(extra?.price), 0);

// The item without its extras: its own line, or the sum of its sub-items
export const calculateBaseAmount = (item) =>
  hasSubItems(item)
    ? getSubItems(item).reduce((sum, sub) => sum + calculateLineAmount(sub), 0)
    : calculateLineAmount(item);

// Everything the item adds to the invoice: base amount + extras
export const calculateItemAmount = (item) => calculateBaseAmount(item) + calculateExtrasTotal(item);

export const calculateItemsSubtotal = (items) =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + calculateItemAmount(item),
    0
  );

// ---------- Per-line quantity visibility
// Each plain item and each sub-item can hide its quantity (showQuantity: false).
// Group items (items with sub-items) never show a quantity themselves.

export const lineShowsQuantity = (line) => line?.showQuantity !== false;

// The lines that can have a quantity: plain items, and the sub-items of groups
export const quantityLines = (items) =>
  (Array.isArray(items) ? items : []).flatMap((item) => (hasSubItems(item) ? getSubItems(item) : [item]));

export const anyLineShowsQuantity = (items) => quantityLines(items).some(lineShowsQuantity);
export const allLinesShowQuantity = (items) => quantityLines(items).every(lineShowsQuantity);

// Older invoices used one invoice-wide switch (includeQuantity: false). Convert it
// to per-line flags so they open correctly in the new form.
export const applyInvoiceQuantityDefault = (items, includeQuantity) => {
  if (!Array.isArray(items) || includeQuantity !== false) return items;
  return items.map((item) => ({
    ...item,
    showQuantity: false,
    ...(Array.isArray(item.subItems)
      ? { subItems: item.subItems.map((sub) => ({ ...sub, showQuantity: false })) }
      : {}),
  }));
};

// Normalise items for PDF templates: every item and sub-item gets an `amount`.
export const prepareItemsForPDF = (items) =>
  (Array.isArray(items) ? items : []).map((item) => {
    const subItems = getSubItems(item).map((sub) => ({
      itemName: sub.itemName || "",
      description: sub.description || "",
      quantity: toNumber(sub.quantity),
      rate: toNumber(sub.rate),
      amount: calculateLineAmount(sub),
      showQuantity: lineShowsQuantity(sub),
    }));
    return {
      itemName: item.itemName || "",
      description: item.description || "",
      quantity: toNumber(item.quantity),
      rate: toNumber(item.rate),
      amount: calculateItemAmount(item),
      showQuantity: lineShowsQuantity(item),
      ...(item.partitionId ? { partitionId: item.partitionId } : {}),
      ...(item.placeBefore ? { placeBefore: item.placeBefore } : {}),
      ...(subItems.length > 0 ? { subItems } : {}),
      ...(hasExtras(item)
        ? {
            extras: getExtras(item).map((extra) => ({
              name: extra.name || "",
              description: extra.description || "",
              price: toNumber(extra.price),
            })),
          }
        : {}),
    };
  });

// Flatten items into table rows for PDF templates.
// rowType: "item" (plain line), "group" (has sub-items), "sub" (a sub-item),
// "extra" (a paid add-on of the item above; itemName = extra name,
// description = what changed, amount = its price, no quantity/rate).
// A plain item row shows its own line amount (its extras are listed below it);
// a group row shows the group's full total (sub-items + extras).
export const flattenInvoiceItems = (items) => {
  const rows = [];
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const subItems = getSubItems(item);
    rows.push({
      ...item,
      amount: subItems.length > 0 ? calculateItemAmount(item) : calculateLineAmount(item),
      rowType: subItems.length > 0 ? "group" : "item",
      key: `item-${index}`,
    });
    subItems.forEach((sub, subIndex) => {
      rows.push({
        ...sub,
        amount: calculateLineAmount(sub),
        rowType: "sub",
        key: `item-${index}-sub-${subIndex}`,
      });
    });
    getExtras(item).forEach((extra, extraIndex) => {
      rows.push({
        itemName: extra.name || "Extra",
        description: extra.description || "",
        quantity: 1,
        rate: toNumber(extra.price),
        amount: toNumber(extra.price),
        showQuantity: false,
        rowType: "extra",
        key: `item-${index}-extra-${extraIndex}`,
      });
    });
  });
  return rows;
};

// Shared react-pdf styles for sub-item rows (plain objects work in style arrays).
export const subItemPdfStyles = {
  groupName: { fontFamily: "Helvetica-Bold" },
  subRow: { backgroundColor: "#F9FAFB" },
  subName: { paddingLeft: 16, color: "#4B5563", fontSize: 9 },
  subCell: { color: "#4B5563", fontSize: 9 },
};

export const SUB_ITEM_BULLET = "•  ";
// Marker in front of an extra's name on PDFs (plain "+", which the standard PDF fonts can render)
export const EXTRA_MARK = "+  ";

// ---------- Work partitions
// An invoice can split its items into named, ordered partitions (e.g. "Quiz",
// "Post design"). Stored as invoice.data.partitions = [{ id, name }] (in display
// order); each item may carry partitionId. Items without a (known) partitionId
// are "loose". A loose item can sit between partitions: placeBefore = the id of
// the partition it sits above, or END_ANCHOR for below the last partition.
// Without placeBefore (older invoices, new items) it sits at the top.
// Invoices without partitions are unchanged.

export const END_ANCHOR = "__end__";

// Where a loose item sits: a partition id it is above, END_ANCHOR, or null (top)
export const looseAnchor = (item, knownPartitionIds) => {
  const anchor = item?.placeBefore;
  if (anchor === END_ANCHOR) return END_ANCHOR;
  return anchor && knownPartitionIds.has(anchor) ? anchor : null;
};

export const getPartitions = (partitions) =>
  (Array.isArray(partitions) ? partitions : []).filter((p) => p && p.id);

export const createPartitionId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// Groups items into display sections, keeping each item's index in the flat list:
// [{ partition: null | { id, name }, items: [{ item, index }], total, anchor? }]
// Loose sections (partition: null) appear where their items sit: at the top,
// between partitions, or after the last one. A loose section is only included
// when it has items (or when there are no partitions at all).
export const buildInvoiceSections = (items, partitions) => {
  const list = Array.isArray(items) ? items : [];
  const parts = getPartitions(partitions);
  const known = new Set(parts.map((p) => p.id));
  const entries = list.map((item, index) => ({ item, index }));
  const sectionFor = (partition, rows, anchor) => ({
    partition,
    items: rows,
    total: rows.reduce((sum, { item }) => sum + calculateItemAmount(item), 0),
    ...(partition ? {} : { anchor }),
  });
  if (parts.length === 0) return [sectionFor(null, entries, null)];

  const loose = entries.filter(({ item }) => !item?.partitionId || !known.has(item.partitionId));
  const looseAt = (anchor) => loose.filter(({ item }) => looseAnchor(item, known) === anchor);
  const sections = [];
  parts.forEach((partition, i) => {
    // The top group and the group above the first partition are the same place
    const before = i === 0 ? [...looseAt(null), ...looseAt(partition.id)] : looseAt(partition.id);
    before.sort((a, b) => a.index - b.index);
    if (before.length > 0) sections.push(sectionFor(null, before, partition.id));
    sections.push(sectionFor(partition, entries.filter(({ item }) => item?.partitionId === partition.id)));
  });
  const after = looseAt(END_ANCHOR);
  if (after.length > 0) sections.push(sectionFor(null, after, END_ANCHOR));
  return sections;
};

// Lines for the end-of-invoice summary, in table order: each item that is not in
// a partition (e.g. "Stickers"), then each partition's total.
// [{ id, name, total, kind: "item" | "partition" }]
// Empty when the invoice has no partitions (the table already lists every item,
// so a summary would only repeat it).
export const getPartitionTotals = (items, partitions) => {
  if (getPartitions(partitions).length === 0) return [];
  return buildInvoiceSections(items, partitions).flatMap((section) =>
    section.partition
      ? [{ id: section.partition.id, name: section.partition.name, total: section.total, kind: "partition" }]
      : section.items.map(({ item, index }) => ({
          id: `item-${index}`,
          name: item.itemName || "Item",
          total: calculateItemAmount(item),
          kind: "item",
        }))
  );
};

// Table rows for PDF templates, grouped by partition. Adds rowType "partition"
// (a header row with the partition name) before each partition's items and
// rowType "partitionTotal" after them. Without partitions this is identical to
// flattenInvoiceItems.
export const flattenInvoiceRows = (items, partitions) => {
  if (getPartitions(partitions).length === 0) return flattenInvoiceItems(items);
  const rows = [];
  buildInvoiceSections(items, partitions).forEach((section, sectionIndex) => {
    const sectionItems = section.items.map(({ item }) => item);
    if (section.partition) {
      rows.push({
        rowType: "partition",
        itemName: section.partition.name || "Untitled partition",
        amount: section.total,
        key: `partition-${section.partition.id}`,
      });
    }
    flattenInvoiceItems(sectionItems).forEach((row) =>
      rows.push({ ...row, key: `s${sectionIndex}-${row.key}` })
    );
    if (section.partition) {
      rows.push({
        rowType: "partitionTotal",
        itemName: `${section.partition.name || "Partition"} total`,
        amount: section.total,
        key: `partition-total-${section.partition.id}`,
      });
    }
  });
  return rows;
};
