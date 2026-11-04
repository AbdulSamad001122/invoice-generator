// Shared helpers for invoice line items and their optional sub-items.
//
// Item shape (stored in invoice.data.items):
//   { itemName, description, quantity, rate, subItems?: [{ itemName, description, quantity, rate }] }
//
// When an item has sub-items, it acts as a group: its amount is the sum of its
// sub-items' amounts, and its own quantity/rate are ignored.

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const getSubItems = (item) =>
  Array.isArray(item?.subItems) ? item.subItems : [];

export const hasSubItems = (item) => getSubItems(item).length > 0;

export const calculateLineAmount = (line) =>
  toNumber(line?.quantity) * toNumber(line?.rate);

export const calculateItemAmount = (item) =>
  hasSubItems(item)
    ? getSubItems(item).reduce((sum, sub) => sum + calculateLineAmount(sub), 0)
    : calculateLineAmount(item);

export const calculateItemsSubtotal = (items) =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + calculateItemAmount(item),
    0
  );

// Normalise items for PDF templates: every item and sub-item gets an `amount`.
export const prepareItemsForPDF = (items) =>
  (Array.isArray(items) ? items : []).map((item) => {
    const subItems = getSubItems(item).map((sub) => ({
      itemName: sub.itemName || "",
      description: sub.description || "",
      quantity: toNumber(sub.quantity),
      rate: toNumber(sub.rate),
      amount: calculateLineAmount(sub),
    }));
    return {
      itemName: item.itemName || "",
      description: item.description || "",
      quantity: toNumber(item.quantity),
      rate: toNumber(item.rate),
      amount: calculateItemAmount(item),
      ...(subItems.length > 0 ? { subItems } : {}),
    };
  });

// Flatten items into table rows for PDF templates.
// rowType: "item" (plain line), "group" (has sub-items), "sub" (a sub-item).
export const flattenInvoiceItems = (items) => {
  const rows = [];
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const subItems = getSubItems(item);
    rows.push({
      ...item,
      amount: calculateItemAmount(item),
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
