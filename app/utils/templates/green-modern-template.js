import React from "react";
import {
  flattenInvoiceRows,
  getPartitionTotals,
  anyLineShowsQuantity,
  calculateItemsSubtotal,
  subItemPdfStyles as subStyles,
  SUB_ITEM_BULLET,
} from "../invoiceItems";
import { normalizePaymentUrl, getPaymentLinkText } from "../paymentLink";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
  Svg,
  Line,
  Polyline,
} from "@react-pdf/renderer";

// Space between the table header and the first partition box, and between boxes
const PARTITION_GAP = 11;
const BOX_BORDER = "#047857"; // dark green box outlines (matches partition names)
const BOX_RADIUS = 4;
const TOTAL_RULE_WIDTH = 1.25; // partition total row's top line

// Create styles for Green Modern Template
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 20,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  // Green header section
  headerSection: {
    backgroundColor: "#10B981",
    padding: 20,
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  companySection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingRight: 12,
  },
  companyLogo: {
    width: 50,
    height: 50,
    borderRadius: 25, // Make logo circular
  },
  companyInfo: {
    flexDirection: "column",
    flexShrink: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  companyEmail: {
    fontSize: 10,
    color: "#FFFFFF",
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  invoiceDetails: {
    flex: 1,
    paddingLeft: 12,
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 5,
  },
  invoiceNumber: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  invoiceDate: {
    fontSize: 10,
    color: "#FFFFFF",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    minWidth: 50,
    borderRadius: 12, // More rounded corners
  },
  statusPaid: {
    backgroundColor: "#059669",
  },
  statusPending: {
    backgroundColor: "#D97706",
  },
  statusCancelled: {
    backgroundColor: "#DC2626",
  },
  // Main content sections
  contentSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  billToSection: {
    width: "45%",
    padding: 15,
    backgroundColor: "#F0FDF4",
    borderLeft: "4px solid #10B981",
  },
  fromSection: {
    width: "45%",
    padding: 15,
    backgroundColor: "#F0FDF4",
    borderLeft: "4px solid #10B981",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 8,
  },
  text: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 2,
  },
  dateSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#F9FAFB",
  },
  dateItem: {
    flexDirection: "column",
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "bold",
  },
  // Table styles
  table: {
    marginBottom: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  itemNameHeader: {
    width: "25%",
    textAlign: "left",
  },
  itemNameHeaderWide: {
    width: "50%",
    textAlign: "left",
  },
  descriptionHeader: {
    width: "25%",
    textAlign: "left",
  },
  qtyHeader: {
    width: "15%",
  },
  qtyHeaderWide: {
    width: "16.67%",
  },
  priceHeader: {
    width: "17.5%",
  },
  priceHeaderWide: {
    width: "16.67%",
  },
  totalHeader: {
    width: "17.5%",
    textAlign: "right",
  },
  totalHeaderWide: {
    width: "16.66%",
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
    textAlign: "center",
  },
  itemNameCell: {
    width: "25%",
    textAlign: "left",
  },
  itemNameCellWide: {
    width: "50%",
    textAlign: "left",
  },
  descriptionCell: {
    width: "25%",
    textAlign: "left",
  },
  qtyCell: {
    width: "15%",
  },
  qtyCellWide: {
    width: "16.67%",
  },
  priceCell: {
    width: "17.5%",
  },
  priceCellWide: {
    width: "16.67%",
  },
  totalCell: {
    width: "17.5%",
    textAlign: "right",
  },
  totalCellWide: {
    width: "16.66%",
    textAlign: "right",
  },
  // Totals section
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totalsSection: {
    width: 270,
    backgroundColor: "#F9FAFB",
    padding: 15,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  totalValue: {
    fontSize: 10,
    color: "#374151",
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#10B981",
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  // The final Total is the dominant number on the invoice
  grandTotalLabel: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    paddingRight: 10,
  },
  grandTotalValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  // Very long amounts step down so they still fit on one line
  grandTotalValueLong: {
    fontSize: 20,
  },
  // Footer sections
  footerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  notesSection: {
    width: "48%",
    padding: 15,
    backgroundColor: "#F0FDF4",
    borderLeft: "4px solid #10B981",
  },
  paymentSection: {
    width: "48%",
    padding: 15,
    backgroundColor: "#F0FDF4",
    borderLeft: "4px solid #10B981",
    alignItems: "flex-end",
    textAlign: "right",
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 8,
  },
  notesText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.4,
    textAlign: "justify",
  },
  paymentTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 3,
    lineHeight: 1.3,
  },
  termsSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#F0FDF4",
  },
  termsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 8,
  },
  termsText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.4,
    textAlign: "justify",
  },
  thankYouSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 6,
  },
  // Work partitions: each partition (header + rows + total) is outlined in light
  // green. The outline is drawn by the rows themselves (header: top, item rows:
  // sides, total: bottom) rather than one bordered wrapper, so when a partition
  // splits across pages each fragment ends exactly at its last row.
  partitionBox: {
    marginTop: PARTITION_GAP,
  },
  // Rows inside a box lose 1pt per side to the outline, so they take 1pt less
  // padding to keep their columns aligned with the table header
  // Every item row (boxed or not) draws these side borders, so the whole items
  // table is closed on the left and right, also across page breaks.
  boxedRow: {
    borderLeftWidth: 1,
    borderLeftColor: BOX_BORDER,
    borderRightWidth: 1,
    borderRightColor: BOX_BORDER,
    paddingHorizontal: 11,
  },
  // A loose block that follows a partition box starts as its own closed box
  sectionStartRow: {
    borderTopWidth: 1,
    borderTopColor: BOX_BORDER,
    borderTopLeftRadius: BOX_RADIUS,
    borderTopRightRadius: BOX_RADIUS,
  },
  // Last row of the ungrouped block closes it like a partition box
  sectionEndRow: {
    borderBottomWidth: 1,
    borderBottomColor: BOX_BORDER,
    borderBottomLeftRadius: BOX_RADIUS,
    borderBottomRightRadius: BOX_RADIUS,
  },
  partitionRow: {
    flexDirection: "row",
    backgroundColor: "#D1FAE5",
    borderTopWidth: 1,
    borderTopColor: BOX_BORDER,
    borderRightWidth: 1,
    borderRightColor: BOX_BORDER,
    borderLeftWidth: 1,
    borderLeftColor: BOX_BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BOX_BORDER,
    borderTopLeftRadius: BOX_RADIUS,
    borderTopRightRadius: BOX_RADIUS,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  partitionName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#047857",
  },
  partitionTotalRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderLeftColor: BOX_BORDER,
    borderRightWidth: 1,
    borderRightColor: BOX_BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BOX_BORDER,
    borderBottomLeftRadius: BOX_RADIUS,
    borderBottomRightRadius: BOX_RADIUS,
    // The rule sits over the row above's (hidden) 1pt separator, so the row only
    // needs room for the rest of its width
    paddingTop: 7 + TOTAL_RULE_WIDTH - 1,
    paddingBottom: 7,
    paddingHorizontal: 11,
    backgroundColor: "#FFFFFF",
  },
  // One solid line in the box colour separates the last item from the total. It is
  // drawn as a bar across the full outer width (over the side borders) rather than
  // a top border, so its ends meet the box sides squarely with no mitred corner.
  // It starts 1pt up, covering the row above's bottom border band and the
  // mitred corners of that row's side borders.
  partitionTotalRule: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    height: TOTAL_RULE_WIDTH,
    backgroundColor: BOX_BORDER,
  },
  partitionTotalText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#047857",
    textAlign: "right",
  },
  // Item group row (an item with sub-items): its own light tint, lighter than the
  // partition header, so it stands out from its (gray) sub-item rows
  groupRow: {
    backgroundColor: "#F0FDF4",
  },
  partitionTotalsList: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 4,
    marginBottom: 4,
  },
  partitionTotalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  partitionTotalLineLabel: {
    flex: 1,
    paddingRight: 8,
    fontSize: 9,
    color: "#6B7280",
  },
  partitionTotalLineValue: {
    fontSize: 9,
    color: "#6B7280",
  },
  // Payment button
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  payButtonText: {
    // Payment box content width (~232pt) minus button padding and icon, so long
    // custom link text wraps inside the button instead of running under the arrow
    maxWidth: 185,
    flexShrink: 1,
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  payButtonIcon: {
    flexShrink: 0,
    width: 10,
    height: 10,
    marginLeft: 6,
  },
  thankYouText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
    textAlign: "center",
  },
});

// Keep a group row together with its sub-items so a page break never splits a
// small group or leaves a group heading orphaned at the bottom of a page. Very
// large groups (taller than a page) only keep the heading with the first sub-item.
// A partition header is kept with the first row/group after it, and a partition
// total with the row/group before it, so neither is stranded alone on a page.
const MAX_ROWS_KEPT_TOGETHER = 12;
const groupRowBlocks = (rows, renderRow) => {
  const blocks = [];
  let pendingHeader = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.rowType === "partition") {
      pendingHeader = renderRow(row, i);
      continue;
    }
    const kept = [];
    if (pendingHeader) {
      kept.push(pendingHeader);
      pendingHeader = null;
    }
    if (row.rowType === "partitionTotal") {
      kept.push(renderRow(row, i));
    } else if (row.rowType === "group" && rows[i + 1]?.rowType === "sub") {
      let end = i + 1;
      while (rows[end + 1]?.rowType === "sub") end++;
      const lastKept = end - i + 1 <= MAX_ROWS_KEPT_TOGETHER ? end : i + 1;
      for (let j = i; j <= lastKept; j++) kept.push(renderRow(rows[j], j));
      i = lastKept;
    } else {
      kept.push(renderRow(row, i));
    }
    // Pull a following partition total into the same block (only when the block
    // ended at the end of its group, so a split large group stays as before)
    if (rows[i + 1]?.rowType === "partitionTotal" && rows[i].rowType !== "partitionTotal") {
      kept.push(renderRow(rows[i + 1], i + 1));
      i++;
    }
    if (kept.length === 1) {
      blocks.push(kept[0]);
    } else {
      blocks.push(
        <View key={`${row.key}-block`} wrap={false}>
          {kept}
        </View>
      );
    }
  }
  if (pendingHeader) blocks.push(pendingHeader);
  return blocks;
};

// Small right-pointing arrow drawn as vector paths (Helvetica has no arrow glyph)
const ArrowIcon = ({ color = "#FFFFFF" }) => (
  <Svg viewBox="0 0 10 10" style={styles.payButtonIcon}>
    <Line x1="1" y1="5" x2="8.5" y2="5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    <Polyline
      points="5.5,2 8.5,5 5.5,8"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Green Modern Template Component
const GreenModernTemplate = ({ invoiceData }) => {
  const {
    companyName,
    companyEmail,
    companyLogo,
    companyCustomFields = [],
    clientName,
    clientEmail,
    clientCustomFields = [],
    invoiceNumber,
    invoiceDate,
    dueDate,
    items,
    taxRate,
    discountRate,
    notes,
    terms,
    showStatusOnPDF = false,
  } = invoiceData;

  // Quantity can be hidden for the whole invoice: then Qty/Price columns are hidden
  // and the item/description columns take their space.
  // Qty/Price columns appear when at least one line shows a quantity
  // (older invoices may also have the invoice-wide switch off)
  const showQuantity = invoiceData.includeQuantity !== false && anyLineShowsQuantity(items);
  // Fixed widths (not flex) so the sub-item indent can't shift the description column.
  // The Total column keeps its width; name (and description) share the rest.
  const totalColWidth = invoiceData.includeDescription ? 17.5 : 16.66;
  const growCol = showQuantity
    ? {}
    : { width: `${(100 - totalColWidth) / (invoiceData.includeDescription ? 2 : 1)}%` };

  // Optional payment link
  const paymentUrl = normalizePaymentUrl(invoiceData.paymentLink);
  const paymentLinkText = getPaymentLinkText(invoiceData.paymentLinkText);

  // Calculate totals
  const subtotal = calculateItemsSubtotal(items);
  const taxAmount = (subtotal * (taxRate || 0)) / 100;
  const discountAmount = (subtotal * (discountRate || 0)) / 100;
  const total = subtotal + taxAmount - discountAmount;

  // Table rows (grouped by work partition when the invoice has partitions)
  const tableRows = items && items.length > 0 ? flattenInvoiceRows(items, invoiceData.partitions) : [];
  const partitionTotals = getPartitionTotals(items, invoiceData.partitions);
  // Zebra striping counts only item rows, so partition rows don't break the pattern
  const stripeIndex = [];
  let stripe = 0;
  tableRows.forEach((row, i) => {
    if (row.rowType === "partition") stripe = 0;
    stripeIndex[i] = row.rowType === "partition" || row.rowType === "partitionTotal" ? 0 : stripe++;
  });
  const totalColStyle = invoiceData.includeDescription ? styles.totalCell : styles.totalCellWide;

  // Split rows into sections: ungrouped rows (not boxed) and one section per partition
  // (header + rows + total), rendered inside an outlined box. Row indexes stay global
  // so the zebra striping above still applies.
  const tableSections = [];
  tableRows.forEach((row, index) => {
    const entry = { ...row, index };
    if (row.rowType === "partition") {
      tableSections.push({ key: `box-${row.key}`, boxed: true, rows: [] });
    } else if (!tableSections.length || (tableSections[tableSections.length - 1].boxed && tableSections[tableSections.length - 1].closed)) {
      tableSections.push({ key: `rows-${row.key}`, boxed: false, rows: [] });
    }
    const section = tableSections[tableSections.length - 1];
    if (section.boxed) entry.partitionKey = section.key;
    section.rows.push(entry);
    if (row.rowType === "partitionTotal") {
      section.closed = true;
      const prev = section.rows[section.rows.length - 2];
      if (prev) prev.beforeTotal = true;
    }
  });
  // The ungrouped block gets a bottom border under its last row; a block that comes
  // after a partition box also gets a top border and the box gap (the block right
  // under the table header keeps its open top)
  tableSections.forEach((section, sectionIndex) => {
    if (section.boxed || !section.rows.length) return;
    section.rows[section.rows.length - 1].sectionEnd = true;
    if (sectionIndex > 0) {
      section.afterBox = true;
      section.rows[0].sectionStart = true;
    }
  });

  const renderTableRow = (item) => {
                const index = item.index;
                if (item.rowType === "partition") {
                  return (
                    <View
                      key={item.key}
                      style={styles.partitionRow}
                      wrap={false}
                    >
                      <Text style={styles.partitionName}>{item.itemName}</Text>
                    </View>
                  );
                }
                if (item.rowType === "partitionTotal") {
                  return (
                    <View key={item.key} style={styles.partitionTotalRow} wrap={false}>
                      <View style={styles.partitionTotalRule} />
                      <Text
                        style={[
                          styles.partitionTotalText,
                          { width: `${100 - totalColWidth}%`, paddingRight: 8 },
                        ]}
                      >
                        {item.itemName}
                      </Text>
                      <Text style={[styles.partitionTotalText, totalColStyle]}>
                        $ {(item.amount || 0).toFixed(2)}
                      </Text>
                    </View>
                  );
                }
                const isSub = item.rowType === "sub";
                const isGroup = item.rowType === "group";
                const subCell = isSub ? subStyles.subCell : null;
                return (
                <View
                  style={[
                    styles.tableRow,
                    stripeIndex[index] % 2 === 1 ? styles.tableRowAlt : null,
                    isSub ? subStyles.subRow : null,
                    isGroup ? styles.groupRow : null,
                    styles.boxedRow,
                    item.sectionStart ? styles.sectionStartRow : null,
                    item.sectionEnd ? styles.sectionEndRow : null,
                    // Hide the grey separator above a partition total by painting it
                    // in the row's own background, so only the total's top line shows
                    // (a zero-width bottom border makes react-pdf redraw the sides)
                    item.beforeTotal
                      ? {
                          borderBottomColor: isGroup
                            ? styles.groupRow.backgroundColor
                            : isSub
                              ? subStyles.subRow.backgroundColor
                              : stripeIndex[index] % 2 === 1
                                ? styles.tableRowAlt.backgroundColor
                                : styles.tableRow.backgroundColor,
                        }
                      : null,
                  ]}
                  key={item.key}
                  wrap={false}
                >
                  <Text
                    style={[
                      styles.tableCell,
                      invoiceData.includeDescription
                        ? styles.itemNameCell
                        : styles.itemNameCellWide, growCol,
                      isGroup ? subStyles.groupName : null,
                      isSub ? subStyles.subName : null,
                    ]}
                  >
                    {isSub ? SUB_ITEM_BULLET : ""}
                    {item.itemName || "Your Item Name"}
                  </Text>
                  {invoiceData.includeDescription && (
                    <Text style={[styles.tableCell, styles.descriptionCell, growCol, subCell]}>
                      {item.description || ""}
                    </Text>
                  )}
                  {showQuantity && (
                    <Text
                      style={[
                        styles.tableCell,
                        invoiceData.includeDescription
                          ? styles.qtyCell
                          : styles.qtyCellWide,
                        subCell,
                      ]}
                    >
                      {isGroup || item.showQuantity === false ? "" : item.quantity || 1}
                    </Text>
                  )}
                  {showQuantity && (
                    <Text
                      style={[
                        styles.tableCell,
                        invoiceData.includeDescription
                          ? styles.priceCell
                          : styles.priceCellWide,
                        subCell,
                      ]}
                    >
                      {isGroup || item.showQuantity === false ? "" : `$ ${(item.rate || 0).toFixed(2)}`}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.tableCell,
                      invoiceData.includeDescription
                        ? styles.totalCell
                        : styles.totalCellWide,
                      subCell,
                      isGroup ? subStyles.groupName : null,
                    ]}
                  >
                    $ {(item.amount || 0).toFixed(2)}
                  </Text>
                </View>
                );
              };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Green Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerContent}>
            <View style={styles.companySection}>
              {companyLogo && (
                <Image
                  src={companyLogo}
                  style={styles.companyLogo}
                  alt="Company Logo"
                />
              )}
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>
                  {companyName || "Company Name"}
                </Text>
                <Text style={styles.companyEmail}>
                  {companyEmail || "company@example.com"}
                </Text>
              </View>
            </View>

            <Text style={styles.invoiceTitle}>INVOICE</Text>

            <View style={styles.invoiceDetails}>
              <Text style={styles.invoiceNumber}>
                NO: {invoiceNumber || "INV-12345-1"}
              </Text>
              <Text style={styles.invoiceDate}>
                Date: {invoiceDate || "26 June 2022"}
              </Text>
              <Text style={styles.invoiceDate}>
                Due: {dueDate || "26 July 2022"}
              </Text>
              {showStatusOnPDF && (
                <Text
                  style={[
                    styles.statusBadge,
                    invoiceData.status === "PAID"
                      ? styles.statusPaid
                      : invoiceData.status === "CANCELLED"
                      ? styles.statusCancelled
                      : styles.statusPending,
                  ]}
                >
                  {invoiceData.status || "PENDING"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Bill To and From Section */}
        <View style={styles.contentSection}>
          <View style={styles.billToSection}>
            <Text style={styles.sectionTitle}>Bill To:</Text>
            <Text style={styles.text}>{clientName || "Client Name"}</Text>
            <Text style={styles.text}>
              {clientEmail || "client@example.com"}
            </Text>
            {clientCustomFields.slice(0, 10).map(
              (field, index) =>
                field.name &&
                field.value && (
                  <Text key={index} style={styles.text}>
                    {field.name.substring(0, 50)}:{" "}
                    {field.value.substring(0, 100)}
                  </Text>
                )
            )}
          </View>
          <View style={styles.fromSection}>
            <Text style={styles.sectionTitle}>From:</Text>
            <Text style={styles.text}>{companyName || "Company Name"}</Text>
            <Text style={styles.text}>
              {companyEmail || "company@example.com"}
            </Text>
            {companyCustomFields.slice(0, 10).map(
              (field, index) =>
                field.name &&
                field.value && (
                  <Text key={index} style={styles.text}>
                    {field.name.substring(0, 50)}:{" "}
                    {field.value.substring(0, 100)}
                  </Text>
                )
            )}
          </View>
        </View>

        {/* Date Section */}
        <View style={styles.dateSection}>
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>Issue Date</Text>
            <Text style={styles.dateValue}>
              {invoiceDate || "26 June 2022"}
            </Text>
          </View>
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>Due Date</Text>
            <Text style={styles.dateValue}>{dueDate || "26 July 2022"}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader} fixed>
            <Text
              style={[
                styles.tableHeaderCell,
                invoiceData.includeDescription
                  ? styles.itemNameHeader
                  : styles.itemNameHeaderWide, growCol,
              ]}
            >
              Item Name
            </Text>
            {invoiceData.includeDescription && (
              <Text style={[styles.tableHeaderCell, styles.descriptionHeader, growCol]}>
                Description
              </Text>
            )}
            {showQuantity && (
              <Text
                style={[
                  styles.tableHeaderCell,
                  invoiceData.includeDescription
                    ? styles.qtyHeader
                    : styles.qtyHeaderWide,
                ]}
              >
                Quantity
              </Text>
            )}
            {showQuantity && (
              <Text
                style={[
                  styles.tableHeaderCell,
                  invoiceData.includeDescription
                    ? styles.priceHeader
                    : styles.priceHeaderWide,
                ]}
              >
                Price
              </Text>
            )}
            <Text
              style={[
                styles.tableHeaderCell,
                invoiceData.includeDescription
                  ? styles.totalHeader
                  : styles.totalHeaderWide,
              ]}
            >
              Total
            </Text>
          </View>

          {/* Table Rows: ungrouped items first, then one outlined box per partition */}
          {tableSections.map((section) =>
            section.boxed ? (
              <View key={section.key} style={styles.partitionBox}>
                {groupRowBlocks(section.rows, renderTableRow)}
              </View>
            ) : (
              <View key={section.key} style={section.afterBox ? styles.partitionBox : undefined}>
                {groupRowBlocks(section.rows, renderTableRow)}
              </View>
            )
          )}
        </View>

        {/* Totals Section */}
        <View style={styles.totalsContainer} wrap={false}>
          <View style={styles.totalsSection}>
            {partitionTotals.length > 0 && (
              <View style={styles.partitionTotalsList}>
                {partitionTotals.map((partition) => (
                  <View key={partition.id} style={styles.partitionTotalLine}>
                    <Text style={styles.partitionTotalLineLabel}>{partition.name || "Untitled partition"}</Text>
                    <Text style={styles.partitionTotalLineValue}>$ {partition.total.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
            {/* Without tax or discount the Subtotal would just repeat the Total */}
            {(taxRate > 0 || discountRate > 0) && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalValue}>$ {subtotal.toFixed(2)}</Text>
              </View>
            )}
            {discountRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Discount ({discountRate}%):
                </Text>
                <Text style={styles.totalValue}>
                  - $ {discountAmount.toFixed(2)}
                </Text>
              </View>
            )}
            {taxRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({taxRate}%):</Text>
                <Text style={styles.totalValue}>$ {taxAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text
                style={[
                  styles.grandTotalValue,
                  total.toFixed(2).length > 10 ? styles.grandTotalValueLong : null,
                ]}
              >
                $ {total.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer Section */}
        <View style={styles.footerSection} wrap={false}>
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes:</Text>
            <Text style={styles.notesText}>
              {notes ||
                "Thank you for your business! We appreciate your trust in our services and look forward to working with you again."}
            </Text>
          </View>
          {(invoiceData.bankName || invoiceData.bankAccount || paymentUrl) && (
            <View style={styles.paymentSection}>
              <Text style={styles.paymentTitle}>Payment Information:</Text>
              {invoiceData.bankName && (
                <Text style={styles.paymentText}>
                  Bank: {invoiceData.bankName}
                </Text>
              )}
              {invoiceData.bankAccount && (
                <Text style={styles.paymentText}>
                  Account: {invoiceData.bankAccount}
                </Text>
              )}
              {paymentUrl && (
                <View style={{ marginTop: 6, alignItems: "flex-end" }}>
                  <Link src={paymentUrl} style={{ textDecoration: "none", marginBottom: 4, maxWidth: "100%" }}>
                    <View style={styles.payButton}>
                      <Text style={styles.payButtonText}>{paymentLinkText}</Text>
                      <ArrowIcon />
                    </View>
                  </Link>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Terms and Conditions Section */}
        {terms && (
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>Terms and Conditions:</Text>
            <Text style={styles.termsText}>{terms}</Text>
          </View>
        )}

        {/* Thank You Section */}
        <View style={styles.thankYouSection} wrap={false}>
          <Text style={styles.thankYouText}>Thank You!</Text>
        </View>
      </Page>
    </Document>
  );
};

export default GreenModernTemplate;
