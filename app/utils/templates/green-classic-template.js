import React from "react";
import {
  flattenInvoiceRows,
  getPartitionTotals,
  anyLineShowsQuantity,
  calculateItemsSubtotal,
  subItemPdfStyles as subStyles,
  SUB_ITEM_BULLET,
  EXTRA_MARK,
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

// Create styles for Green Classic Template (based on the provided image)
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  // Green header background
  headerBackground: {
    backgroundColor: "#9ACD32",
    minHeight: 80,
    marginBottom: 20,
  },
  headerContent: {
    minHeight: 80,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
    paddingRight: 12,
  },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  companyEmail: {
    fontSize: 10,
    color: "#FFFFFF",
  },
  headerCenter: {
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "center",
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  headerRight: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-end",
    paddingLeft: 12,
  },
  invoiceNumberLabel: {
    fontSize: 10,
    color: "#FFFFFF",
    marginBottom: 2,
  },
  invoiceNumberValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
    textAlign: "right",
  },
  dateLabel: {
    fontSize: 10,
    color: "#FFFFFF",
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 10,
    color: "#FFFFFF",
  },

  // Company logo styles
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 20, // Make logo circular
    marginBottom: 5,
  },

  // Status badge styles
  statusBadge: {
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12, // More rounded corners
    marginTop: 5,
    textAlign: "center",
  },
  statusPaid: {
    backgroundColor: "#10B981",
    color: "#FFFFFF",
  },
  statusPending: {
    backgroundColor: "#F59E0B",
    color: "#FFFFFF",
  },
  statusCancelled: {
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
  },

  // Content sections for Bill To and From
  contentSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  billToSection: {
    width: "45%",
  },
  fromSection: {
    width: "45%",
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 10,
    color: "#000000",
    marginBottom: 2,
  },

  // Date section
  dateSection: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 20,
    gap: 60,
  },
  dateItem: {
    flexDirection: "column",
  },
  dateItemLabel: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 3,
  },
  dateItemValue: {
    fontSize: 11,
    color: "#9ACD32",
    fontWeight: "bold",
  },

  // Table styles
  // No bottom margin on the table: react-pdf counts a margin below an unbreakable-
  // looking block as "presence" and, when the table starts a page and ends within
  // that margin of the page bottom, it moves the table to a new page forever
  // (infinite empty pages). The gap lives on the totals block instead (20 + 15).
  table: {},
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#9ACD32",
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  tableHeaderCell: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },

  itemNameHeader: {
    width: "45%",
    textAlign: "left",
  },
  itemNameHeaderWide: {
    width: "55%",
    textAlign: "left",
  },
  descriptionHeader: {
    width: "45%",
    textAlign: "left",
  },
  descriptionHeaderWide: {
    width: "55%",
    textAlign: "left",
  },
  priceHeader: {
    width: "18%",
    textAlign: "center",
  },
  priceHeaderWide: {
    width: "22%",
    textAlign: "center",
  },
  qtyHeader: {
    width: "12%",
    textAlign: "center",
  },
  qtyHeaderWide: {
    width: "18%",
    textAlign: "center",
  },
  totalHeader: {
    width: "15%",
    textAlign: "right",
  },
  totalHeaderWide: {
    width: "25%",
    textAlign: "right",
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    fontSize: 10,
    color: "#000000",
    textAlign: "center",
  },
  // Gap between the text columns and the numeric columns
  textCellGutter: {
    paddingRight: 8,
  },

  itemNameCell: {
    width: "45%",
    textAlign: "left",
  },
  itemNameCellWide: {
    width: "55%",
    textAlign: "left",
  },
  descriptionCell: {
    width: "45%",
    textAlign: "left",
  },
  descriptionCellWide: {
    width: "55%",
    textAlign: "left",
  },
  priceCell: {
    width: "18%",
    textAlign: "center",
  },
  priceCellWide: {
    width: "22%",
    textAlign: "center",
  },
  qtyCell: {
    width: "12%",
    textAlign: "center",
  },
  qtyCellWide: {
    width: "18%",
    textAlign: "center",
  },
  totalCell: {
    width: "15%",
    textAlign: "right",
  },
  totalCellWide: {
    width: "25%",
    textAlign: "right",
  },

  // Item name and description styles
  itemNameText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 2,
  },
  itemDescriptionText: {
    fontSize: 9,
    color: "#666666",
    fontStyle: "italic",
  },

  // Totals section
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 35,
  },
  totalsSection: {
    width: 280,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 15,
  },
  totalLabel: {
    fontSize: 11,
    color: "#000000",
  },
  totalValue: {
    fontSize: 11,
    color: "#000000",
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#9ACD32",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 20,
    color: "#000000",
    fontFamily: "Helvetica-Bold",
    paddingRight: 10,
  },
  grandTotalValue: {
    fontSize: 24,
    color: "#000000",
    fontFamily: "Helvetica-Bold",
  },

  // Footer sections
  footerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  termsSection: {
    width: "48%",
  },
  paymentSection: {
    width: "48%",
    alignItems: "flex-end",
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
  },
  footerText: {
    fontSize: 10,
    color: "#000000",
    lineHeight: 1.4,
    marginBottom: 3,
  },
  footerTitleSpaced: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
    marginTop: 15,
  },
  thankYouText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    marginTop: 85,
    // No bottom margin: the page padding already provides it, and a margin here
    // pushed the closing block onto a new page on otherwise-full single pages.
  },

  // Work partitions: each partition (header + rows + total) is drawn as an
  // outlined box. The outline lives on the rows themselves (sides on every row,
  // top on the header, bottom on the total) so a partition split across pages
  // still looks clean on each page.
  partitionGap: {
    marginTop: 11,
  },
  partitionRow: {
    flexDirection: "row",
    backgroundColor: "#E6F2C8",
    borderLeftWidth: 1,
    borderLeftColor: "#4D7C0F",
    borderTopWidth: 1,
    borderTopColor: "#4D7C0F",
    borderRightWidth: 1,
    borderRightColor: "#4D7C0F",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 14,
  },
  partitionName: {
    width: "100%",
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    color: "#4D7C0F",
  },
  // Item rows inside a partition box: side borders, padding reduced by the
  // border width so the columns stay aligned with the table header
  boxSides: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: "#4D7C0F",
    borderRightColor: "#4D7C0F",
    paddingHorizontal: 14,
  },
  // Last item row of the ungrouped block (rows not in any partition): closes
  // that block's box with a bottom border and rounded bottom corners
  // First item row of an ungrouped block that follows a partition box: opens
  // its own closed box (top border, rounded top corners)
  boxTop: {
    borderTopWidth: 1,
    borderTopColor: "#4D7C0F",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  boxBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#4D7C0F",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  // The total's top line sits over the last item row's grey separator
  // (marginTop -1), so exactly one straight accent line divides them.
  partitionTotalRow: {
    flexDirection: "row",
    marginTop: -1,
    borderTopWidth: 1.25,
    borderTopColor: "#4D7C0F",
    borderBottomWidth: 1,
    borderBottomColor: "#4D7C0F",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  partitionTotalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#4D7C0F",
    textAlign: "right",
    paddingRight: 8,
  },
  partitionTotalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#4D7C0F",
    textAlign: "right",
  },
  // Item group row (has sub-items): a light neutral tint, softer than a partition header
  groupRow: {
    backgroundColor: "#EBEFE3",
  },
  // Extra (paid add-on of the item above): indented like a sub-item, on a warm
  // tint with an accent "+", so it reads as an add-on rather than a sub-item
  extraRow: {
    // No tint: extras use the normal row background
  },
  extraNameCell: {
    paddingLeft: 16,
  },
  extraName: {
    fontSize: 9.5,
    color: "#1F2937",
  },
  extraMark: {
    fontFamily: "Helvetica-Bold",
    color: "#4D7C0F",
  },
  extraDescription: {
    fontSize: 8.5,
    color: "#6B7280",
    marginTop: 2,
    paddingLeft: 11,
    lineHeight: 1.3,
  },
  extraAmount: {
    color: "#1F2937",
  },
  partitionSummary: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 3,
    marginBottom: 3,
  },
  partitionSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 15,
  },
  partitionSummaryLabel: {
    fontSize: 10,
    color: "#6B7280",
    flexShrink: 1,
    paddingRight: 8,
  },
  partitionSummaryValue: {
    fontSize: 10,
    color: "#4B5563",
  },

  // Payment button (the whole button is the link area)
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9ACD32",
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  payButtonText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  payButtonIcon: {
    marginLeft: 7,
  },
});

// Hyphenation is disabled app-wide (index.js), so react-pdf only wraps at spaces and a
// long unbroken word would run into the next column. On this template's wrapping text,
// allow very long words to break every few characters (react-pdf adds the hyphen).
const breakLongWords = (word) =>
  word.length > 18 ? word.match(/.{1,6}/g) : [word];

// Green Classic Template Component
const GreenClassicTemplate = ({ invoiceData }) => {
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
    status,
    items,
    taxRate,
    discountRate,
    notes,
    terms,
    bankName,
    bankAccount,
    showStatusOnPDF = false,
    includeDescription = false,
  } = invoiceData;

  // Quantity can be hidden for the whole invoice: then Qty/Price columns are hidden
  // and the item/description columns take their space.
  // Qty/Price columns appear when at least one line shows a quantity
  // (older invoices may also have the invoice-wide switch off)
  const showQuantity = invoiceData.includeQuantity !== false && anyLineShowsQuantity(items);
  // Fixed widths (not flex) so the sub-item indent can't shift the description column.
  // The Total column keeps its width; name (and description) share the rest.
  const totalColWidth = invoiceData.includeDescription ? 15 : 25;
  const growCol = showQuantity
    ? {}
    : { width: `${(100 - totalColWidth) / (invoiceData.includeDescription ? 2 : 1)}%` };

  // Optional payment link
  const paymentUrl = normalizePaymentUrl(invoiceData.paymentLink);
  const paymentLinkText = getPaymentLinkText(invoiceData.paymentLinkText);

  const hasFooter = Boolean(terms || notes || bankName || bankAccount || paymentUrl);
  // Keep the closing block (footer + "Thank You") unsplit unless notes/terms are so
  // long that the block could not fit on a single page.
  const keepClosingTogether = String(terms || "").length + String(notes || "").length < 900;

  // Calculate totals
  const subtotal = calculateItemsSubtotal(items);
  const taxAmount = (subtotal * (taxRate || 0)) / 100;
  const discountAmount = (subtotal * (discountRate || 0)) / 100;
  const total = subtotal + taxAmount - discountAmount;

  // Work partitions (empty when the invoice has none)
  const partitionTotals = getPartitionTotals(items, invoiceData.partitions);
  const hasPartitions = partitionTotals.length > 0;
  // Format currency
  const formatCurrency = (amount) => {
    return `$${(amount || 0).toFixed(2)}`;
  };

  // Table rows. Zebra striping restarts under each partition header (unchanged
  // without partitions); rows inside a partition are drawn inside its box.
  const rows = flattenInvoiceRows(items, invoiceData.partitions);
  {
    let stripe = -1;
    let inPartition = false;
    rows.forEach((row, index) => {
      if (row.rowType === "partition") {
        inPartition = true;
        stripe = -1;
      } else if (row.rowType === "partitionTotal") {
        inPartition = false;
      } else {
        // Ungrouped rows right after a partition box start their own box:
        // gap + top border, and the striping restarts like under a header
        const prev = rows[index - 1];
        row.opensBox = !inPartition && Boolean(prev && prev.rowType === "partitionTotal");
        if (row.opensBox) stripe = -1;
        // Extras have their own tint and don't affect the striping
        if (row.rowType !== "extra") stripe += 1;
        row.stripe = stripe;
        row.inBox = inPartition;
        // Ungrouped rows form their own closed box: its last row draws the bottom
        const after = rows[index + 1];
        row.closesBox = !inPartition && (!after || after.rowType === "partition");
      }
    });
  }

  const renderRow = (item) => {
    if (item.rowType === "partition") {
      return (
        <View key={item.key} wrap={false} style={styles.partitionRow}>
          <Text style={styles.partitionName} hyphenationCallback={breakLongWords}>
            {item.itemName}
          </Text>
        </View>
      );
    }
    if (item.rowType === "partitionTotal") {
      return (
        <View key={item.key} wrap={false} style={[styles.partitionTotalRow, styles.boxSides]}>
          <Text
            style={[styles.partitionTotalLabel, { width: `${100 - totalColWidth}%` }]}
            hyphenationCallback={breakLongWords}
          >
            {item.itemName}
          </Text>
          <Text style={[styles.partitionTotalValue, { width: `${totalColWidth}%` }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
      );
    }
    if (item.rowType === "extra") {
      return (
        <View
          key={item.key}
          wrap={false}
          style={[
            styles.tableRow,
            styles.extraRow,
            styles.boxSides,
            item.opensBox ? [styles.boxTop, styles.partitionGap] : {},
            item.closesBox ? styles.boxBottom : {},
          ]}
        >
          <View
            style={[
              includeDescription ? styles.itemNameCell : styles.itemNameCellWide,
              growCol,
              styles.textCellGutter,
              styles.extraNameCell,
            ]}
          >
            <Text style={styles.extraName} hyphenationCallback={breakLongWords}>
              <Text style={styles.extraMark}>{EXTRA_MARK}</Text>
              {item.itemName || "Extra"}
            </Text>
            {item.description ? (
              <Text style={styles.extraDescription} hyphenationCallback={breakLongWords}>
                {item.description}
              </Text>
            ) : null}
          </View>
          {includeDescription && (
            <Text style={[styles.tableCell, styles.descriptionCell, growCol, styles.textCellGutter]} />
          )}
          {showQuantity && (
            <Text style={[styles.tableCell, includeDescription ? styles.qtyCell : styles.qtyCellWide]} />
          )}
          {showQuantity && (
            <Text style={[styles.tableCell, includeDescription ? styles.priceCell : styles.priceCellWide]} />
          )}
          <Text
            style={[
              styles.tableCell,
              includeDescription ? styles.totalCell : styles.totalCellWide,
              styles.extraAmount,
            ]}
          >
            {formatCurrency(item.amount)}
          </Text>
        </View>
      );
    }
    const isSub = item.rowType === "sub";
    const isGroup = item.rowType === "group";
    const subCell = isSub ? subStyles.subCell : null;
    return (
      <View
        key={item.key}
        wrap={false}
        style={[
          styles.tableRow,
          item.stripe % 2 === 1 ? styles.tableRowAlt : {},
          isSub ? subStyles.subRow : {},
          isGroup ? styles.groupRow : {},
          styles.boxSides,
          item.opensBox ? [styles.boxTop, styles.partitionGap] : {},
          item.closesBox ? styles.boxBottom : {},
        ]}
      >
        <Text
          style={[
            styles.tableCell,
            includeDescription ? styles.itemNameCell : styles.itemNameCellWide,
            growCol,
            styles.textCellGutter,
            isGroup ? subStyles.groupName : {},
            isSub ? subStyles.subName : {},
          ]}
          hyphenationCallback={breakLongWords}
        >
          {isSub ? SUB_ITEM_BULLET : ""}
          {item.itemName || "Item Name"}
        </Text>
        {includeDescription && (
          <Text
            style={[styles.tableCell, styles.descriptionCell, growCol, styles.textCellGutter, subCell || {}]}
            hyphenationCallback={breakLongWords}
          >
            {item.description || ""}
          </Text>
        )}
        {showQuantity && (
          <Text
            style={[
              styles.tableCell,
              includeDescription ? styles.qtyCell : styles.qtyCellWide,
              subCell || {},
            ]}
          >
            {isGroup || item.showQuantity === false ? "" : item.quantity || 1}
          </Text>
        )}
        {showQuantity && (
          <Text
            style={[
              styles.tableCell,
              includeDescription ? styles.priceCell : styles.priceCellWide,
              subCell || {},
            ]}
          >
            {isGroup || item.showQuantity === false ? "" : formatCurrency(item.rate)}
          </Text>
        )}
        <Text
          style={[
            styles.tableCell,
            includeDescription ? styles.totalCell : styles.totalCellWide,
            subCell || {},
            isGroup ? subStyles.groupName : {},
          ]}
        >
          {formatCurrency(item.amount)}
        </Text>
      </View>
    );
  };

  // Keep-together blocks: an item/group row stays with its sub-items and extras
  // (all of them for normal-sized blocks, only the first one for very long
  // ones); a partition
  // header travels with its first row/group; a partition total stays on the
  // same page as the row above it.
  const MAX_KEEP_TOGETHER = 12;
  let rowBlocks = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].rowType !== "group" && rows[i].rowType !== "item") {
      rowBlocks.push([rows[i]]);
      continue;
    }
    let j = i + 1;
    while (j < rows.length && (rows[j].rowType === "sub" || rows[j].rowType === "extra")) j++;
    const keep = j - i - 1 <= MAX_KEEP_TOGETHER ? j : Math.min(j, i + 2);
    rowBlocks.push(rows.slice(i, keep));
    for (let k = keep; k < j; k++) rowBlocks.push([rows[k]]);
    i = j - 1;
  }
  {
    const merged = [];
    for (let b = 0; b < rowBlocks.length; b++) {
      const block = rowBlocks[b];
      const type = block[0].rowType;
      const next = rowBlocks[b + 1];
      if (type === "partition" && next && next[0].rowType !== "partitionTotal") {
        merged.push([...block, ...next]);
        b++;
      } else if (type === "partitionTotal" && merged.length > 0) {
        merged[merged.length - 1] = [...merged[merged.length - 1], ...block];
      } else {
        merged.push(block);
      }
    }
    rowBlocks = merged;
  }
  // A block starting with a partition header opens a new box. The gap above it
  // is a margin on that unbreakable block, so it moves with the box to a new
  // page (same small gap under the repeated table header).
  const renderBlock = (block) => {
    const opensBox = block[0].rowType === "partition";
    if (block.length === 1 && !opensBox) return renderRow(block[0]);
    return (
      <View
        key={`blk-${block[0].key}`}
        style={opensBox ? styles.partitionGap : undefined}
        wrap={false}
      >
        {block.map(renderRow)}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Green Header Background */}
        <View style={styles.headerBackground}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              {companyLogo && (
                <Image
                  src={companyLogo}
                  style={styles.companyLogo}
                  alt="Company Logo"
                />
              )}
              <Text style={styles.companyName}>{companyName || "Adzilla"}</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.invoiceNumberLabel}>NO:</Text>
              <Text style={styles.invoiceNumberValue}>
                {invoiceNumber || "INV-39"}
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
            <Text style={styles.sectionText}>
              {clientName || "M. Haris Junianto"}
            </Text>
            <Text style={styles.sectionText}>
              {clientEmail || "client@example.com"}
            </Text>
            {clientCustomFields.slice(0, 10).map(
              (field, index) =>
                field.name &&
                field.value && (
                  <Text key={index} style={styles.sectionText}>
                    {field.name.substring(0, 50)}:{" "}
                    {field.value.substring(0, 100)}
                  </Text>
                )
            )}
          </View>
          <View style={styles.fromSection}>
            <Text style={styles.sectionTitle}>From:</Text>
            <Text style={styles.sectionText}>
              {companyName || "YOUR COMPANY"}
            </Text>
            <Text style={styles.sectionText}>
              {companyEmail || "company@example.com"}
            </Text>
            {companyCustomFields.slice(0, 10).map(
              (field, index) =>
                field.name &&
                field.value && (
                  <Text key={index} style={styles.sectionText}>
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
            <Text style={styles.dateItemLabel}>Issue Date:</Text>
            <Text style={styles.dateItemValue}>
              {invoiceDate || "2025-09-04"}
            </Text>
          </View>
          <View style={styles.dateItem}>
            <Text style={styles.dateItemLabel}>Due Date:</Text>
            <Text style={styles.dateItemValue}>{dueDate || "2025-09-06"}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader} fixed>
            <Text
              style={[
                styles.tableHeaderCell,
                includeDescription
                  ? styles.itemNameHeader
                  : styles.itemNameHeaderWide, growCol,
              ]}
            >
              Item Name
            </Text>
            {includeDescription && (
              <Text style={[styles.tableHeaderCell, styles.descriptionHeader, growCol]}>
                Description
              </Text>
            )}
            {showQuantity && (
              <Text
                style={[
                  styles.tableHeaderCell,
                  includeDescription ? styles.qtyHeader : styles.qtyHeaderWide,
                ]}
              >
                Quantity
              </Text>
            )}
            {showQuantity && (
              <Text
                style={[
                  styles.tableHeaderCell,
                  includeDescription
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
                includeDescription
                  ? styles.totalHeader
                  : styles.totalHeaderWide,
              ]}
            >
              Subtotal
            </Text>
          </View>

          {/* Table Rows */}
          {rowBlocks.map(renderBlock)}
        </View>

        {/* Totals Section */}
        {/* With no footer, the totals travel with "Thank You" so it never sits alone on a page */}
        <View wrap={!(keepClosingTogether && !hasFooter)}>
        <View style={styles.totalsContainer} wrap={false}>
          <View style={styles.totalsSection}>
            {hasPartitions && (
              <View style={styles.partitionSummary}>
                {partitionTotals.map((p) => (
                  <View key={p.id} style={styles.partitionSummaryRow}>
                    <Text style={styles.partitionSummaryLabel} hyphenationCallback={breakLongWords}>
                      {p.name || "Untitled partition"}
                    </Text>
                    <Text style={styles.partitionSummaryValue}>{formatCurrency(p.total)}</Text>
                  </View>
                ))}
              </View>
            )}
            {/* Sub Total only when tax/discount make it differ from the Total */}
            {(taxRate > 0 || discountRate > 0) && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
              </View>
            )}
            {taxRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Taxes ({taxRate}%)</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(taxAmount)}
                </Text>
              </View>
            )}
            {discountRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Discount ({discountRate}%)
                </Text>
                <Text style={styles.totalValue}>
                  -{formatCurrency(discountAmount)}
                </Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(total)}
              </Text>
            </View>
          </View>
        </View>

        {!hasFooter && <Text style={styles.thankYouText}>Thank You</Text>}
        </View>

        {/* Footer Section + Thank You kept on one page (when short enough to fit) */}
        {hasFooter && (
        <View wrap={!keepClosingTogether}>
          <View style={styles.footerSection}>
            {(terms || notes) && (
              <View style={styles.termsSection}>
                {terms && (
                  <>
                    <Text style={styles.footerTitle}>Term & Condition</Text>
                    <Text style={styles.footerText} hyphenationCallback={breakLongWords}>{terms}</Text>
                  </>
                )}
                {notes && (
                  <>
                    <Text
                      style={[
                        styles.footerTitle,
                        terms ? styles.footerTitleSpaced : {},
                      ]}
                    >
                      Notes
                    </Text>
                    <Text style={styles.footerText} hyphenationCallback={breakLongWords}>{notes}</Text>
                  </>
                )}
              </View>
            )}
            {(bankName || bankAccount || paymentUrl) && (
              <View style={styles.paymentSection}>
                <Text style={styles.footerTitle}>Payment Method :</Text>
                {bankAccount && (
                  <Text style={styles.footerText}>
                    Account# : {bankAccount}
                  </Text>
                )}
                {bankName && (
                  <Text style={styles.footerText}>A/C Name : {bankName}</Text>
                )}
                {paymentUrl && (
                  <View style={{ marginTop: 6, alignItems: "flex-end" }}>
                    <Link src={paymentUrl} style={{ textDecoration: "none" }}>
                      <View style={styles.payButton}>
                        <Text style={styles.payButtonText}>{paymentLinkText}</Text>
                        <Svg width={10} height={10} viewBox="0 0 10 10" style={styles.payButtonIcon}>
                          <Line x1="1" y1="5" x2="8.5" y2="5" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
                          <Polyline
                            points="5.5,2 8.5,5 5.5,8"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    </Link>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Thank You Message */}
          <Text style={styles.thankYouText}>Thank You</Text>
        </View>
        )}
      </Page>
    </Document>
  );
};

export default GreenClassicTemplate;
