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
  Path,
} from "@react-pdf/renderer";

// Create styles for Yellow Classic Template
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#F5D547", // Yellow background
    padding: 20,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  // Header section
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    paddingBottom: 20,
  },
  // Left (logo + name) and right (invoice details) columns share the space equally so
  // the INVOICE title stays centred and long company names wrap instead of
  // running underneath the title.
  logoSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 10,
  },
  companyLogo: {
    marginLeft: 10,
    width: 50,
    height: 50,
    borderRadius: 25, // Make logo circular
  },
  companyName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
  },
  invoiceTitleSection: {
    flexShrink: 0,
    alignItems: "center",
  },
  invoiceTitle: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 3,
    marginBottom: 5,
  },
  invoiceDetails: {
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 10,
  },
  invoiceNumber: {
    textAlign: "right",
    fontSize: 12,
    color: "#000000",
    fontWeight: "bold",
    marginBottom: 5,
  },
  invoiceDate: {
    fontSize: 10,
    color: "#000000",
    marginBottom: 2,
  },
  dueDate: {
    fontSize: 10,
    color: "#000000",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    minWidth: 60,
    marginTop: 5,
    borderRadius: 12, // More rounded corners
  },
  statusPaid: {
    backgroundColor: "#10B981",
  },
  statusPending: {
    backgroundColor: "#F59E0B",
  },
  statusCancelled: {
    backgroundColor: "#EF4444",
  },
  // Bill To and From Section
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
  text: {
    fontSize: 10,
    color: "#000000",
    marginBottom: 2,
  },
  // Payment Method Section
  paymentMethodSection: {
    marginBottom: 20,
  },
  paymentMethodTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 5,
  },
  paymentMethodText: {
    fontSize: 10,
    color: "#000000",
  },
  // Table styles
  // The outline is drawn per row (not on the table View) so a table split across
  // pages doesn't leave dangling side borders below the last row on a page.
  // No marginBottom here: react-pdf counts a bottom margin when deciding whether
  // a block fits, so a table ending near the page bottom would jump whole to the
  // next page. The gap below lives in totalsContainer.marginTop instead.
  table: {},
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#000000",
    paddingVertical: 8,
    paddingHorizontal: 10,
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
    borderBottomColor: "#000000",
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F5D547",
  },
  tableCell: {
    fontSize: 9,
    color: "#000000",
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
  // Work partitions: each partition (header + rows + "<Name> total") sits in its
  // own outlined box with slightly rounded corners. The header row is the
  // strongest highlight (darker yellow tint); its left edge is the plain box border.
  partitionBox: {
    marginTop: 11,
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 4,
  },
  partitionRow: {
    flexDirection: "row",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: "#E6C12E",
  },
  partitionName: {
    flex: 1,
    paddingVertical: 7,
    paddingRight: 10,
    paddingLeft: 10,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    letterSpacing: 0.3,
  },
  // Ungrouped rows (not in any partition) read as a closed box too: side borders
  // run down from the header bar and the last row closes it with a bottom border
  // and rounded corners, matching the partition boxes. The sides are drawn per
  // row (not on a wrapping View) so a block split across pages ends exactly at
  // the last row on the page instead of leaving side stubs below it.
  looseRow: {
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    borderBottomWidth: 0.75,
    borderBottomColor: "#B89A22",
  },
  looseRowFirstDetached: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  looseRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  // A loose block that follows a partition box is its own box, with the gap
  looseBlockDetached: {
    marginTop: 11,
  },
  // Item rows inside a box: the box draws the outer edges, rows only separate
  boxedRow: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0.75,
    borderBottomColor: "#B89A22",
  },
  boxedRowLast: {
    borderBottomWidth: 0,
  },
  partitionTotalRow: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopWidth: 1.25,
    borderTopColor: "#000000",
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  partitionTotalLabel: {
    textAlign: "right",
    paddingRight: 10,
    fontFamily: "Helvetica-Bold",
  },
  partitionTotalValue: {
    fontFamily: "Helvetica-Bold",
  },
  // Item group rows (an item with sub-items): a pale cream tint, lighter than
  // the partition header and distinct from the near-white sub-item rows
  groupRow: {
    backgroundColor: "#FBE7A1",
  },
  // Totals section
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 25,
    // No bottom margin: the gap below lives in footerSection.marginTop so the
    // unbreakable totals block only needs its own height to fit on a page.
  },
  totalsSection: {
    width: 260,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 10,
    color: "#000000",
  },
  totalValue: {
    fontSize: 10,
    color: "#000000",
    fontWeight: "bold",
  },
  // Per-partition lines above Subtotal: like the Subtotal line but lighter
  partitionTotalsBlock: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#8A7414",
    paddingBottom: 3,
    marginBottom: 3,
  },
  partitionSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  partitionSummaryLabel: {
    flex: 1,
    paddingRight: 8,
    fontSize: 9,
    color: "#4A3F0C",
  },
  partitionSummaryValue: {
    fontSize: 9,
    color: "#4A3F0C",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#000000",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  // The final Total is the dominant number on the invoice
  grandTotalLabel: {
    fontSize: 20,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    paddingRight: 12,
  },
  grandTotalValue: {
    fontSize: 24,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  // Footer section
  footerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    // (no marginBottom, for the same reason as the table; the gap above the
    // terms lives in termsSection.marginTop)
  },
  paymentSection: {
    width: "48%",
    alignItems: "flex-end",
    textAlign: "right",
  },
  paymentTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 10,
    color: "#000000",
    marginBottom: 3,
  },
  // Pay button: the whole black pill is the link area
  payButtonLink: {
    marginTop: 4,
    marginBottom: 4,
    textDecoration: "none",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  payButtonText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  payButtonIcon: {
    width: 10,
    height: 10,
    marginLeft: 7,
  },
  payUrl: {
    fontSize: 8,
    color: "#4A3F0C",
    textDecoration: "none",
  },
  // Notes and Terms sections
  notesSection: {
    width: "48%",
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 5,
  },
  notesText: {
    fontSize: 10,
    color: "#000000",
    lineHeight: 1.4,
  },
  termsSection: {
    marginTop: 24,
  },
  termsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 5,
  },
  termsText: {
    fontSize: 10,
    color: "#000000",
    lineHeight: 1.4,
  },
});

// Yellow Classic Invoice Template Component
const YellowClassicTemplate = ({ invoiceData }) => {
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

  // Table rows, grouped by work partition when the invoice has partitions
  const rows = flattenInvoiceRows(items, invoiceData.partitions);
  const partitionTotals = getPartitionTotals(items, invoiceData.partitions);
  // Sub Total only adds information when tax or discount changes the Total
  const showSubtotal = (taxRate || 0) > 0 || (discountRate || 0) > 0;

  // Split the rows into segments: loose rows (ungrouped items, drawn as before)
  // and partitions (header ... "<Name> total"), each drawn inside its own box.
  const segments = [];
  rows.forEach((row) => {
    const last = segments[segments.length - 1];
    if (row.rowType === "partition") {
      segments.push({ key: `box-${row.key}`, partition: true, rows: [row], open: true });
    } else if (last && last.partition && last.open) {
      last.rows.push(row);
      if (row.rowType === "partitionTotal") last.open = false;
    } else if (last && !last.partition) {
      last.rows.push(row);
    } else {
      segments.push({ key: `rows-${row.key}`, partition: false, rows: [row] });
    }
  });

  const renderRow = (
    item,
    { boxed = false, beforeTotal = false, loose = false, looseFirst = false, looseLast = false }
  ) => {
    if (item.rowType === "partition") {
      return (
        <View
          key={item.key}
          style={styles.partitionRow}
          wrap={false}
          // Never strand a partition header at the bottom of a page
          minPresenceAhead={60}
        >
          <Text style={styles.partitionName}>{item.itemName}</Text>
        </View>
      );
    }
    if (item.rowType === "partitionTotal") {
      return (
        <View
          key={item.key}
          style={[styles.tableRow, styles.partitionTotalRow]}
          wrap={false}
        >
          <Text
            style={[
              styles.tableCell,
              styles.partitionTotalLabel,
              { width: `${100 - totalColWidth}%` },
            ]}
          >
            {item.itemName}
          </Text>
          <Text
            style={[
              styles.tableCell,
              invoiceData.includeDescription ? styles.totalCell : styles.totalCellWide,
              styles.partitionTotalValue,
            ]}
          >
            ${(item.amount || 0).toFixed(2)}
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
          isSub ? subStyles.subRow : null,
          isGroup ? styles.groupRow : null,
          boxed ? styles.boxedRow : null,
          boxed && beforeTotal ? styles.boxedRowLast : null,
          loose ? styles.looseRow : null,
          looseFirst ? styles.looseRowFirstDetached : null,
          looseLast ? styles.looseRowLast : null,
        ]}
        key={item.key}
        wrap={false}
        // Keep a group heading on the same page as its first sub-item
        minPresenceAhead={isGroup ? 30 : 0}
      >
        <Text
          style={[
            styles.tableCell,
            invoiceData.includeDescription ? styles.itemNameCell : styles.itemNameCellWide,
            growCol,
            isGroup ? subStyles.groupName : null,
            isSub ? subStyles.subName : null,
          ]}
        >
          {isSub ? SUB_ITEM_BULLET : ""}
          {item.itemName || "1 Logo Design"}
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
              invoiceData.includeDescription ? styles.qtyCell : styles.qtyCellWide,
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
              invoiceData.includeDescription ? styles.priceCell : styles.priceCellWide,
              subCell,
            ]}
          >
            {isGroup || item.showQuantity === false ? "" : `$${(item.rate || 0).toFixed(2)}`}
          </Text>
        )}
        <Text
          style={[
            styles.tableCell,
            invoiceData.includeDescription ? styles.totalCell : styles.totalCellWide,
            subCell,
            isGroup ? subStyles.groupName : null,
          ]}
        >
          ${(item.amount || 0).toFixed(2)}
        </Text>
      </View>
    );
  };

  // Rough height (pt) of the notes/payment footer incl. its top margin. The totals
  // block asks for this much room after it so the footer starts on the same page
  // (capped so very long notes still just flow onto the next page).
  const notesLines = Math.ceil(String(notes || "x").length / 45);
  const notesHeight = 20 + notesLines * 14;
  const paymentHeight =
    (invoiceData.bankName || invoiceData.bankAccount || paymentUrl ? 22 : 0) +
    (invoiceData.bankName ? 16 : 0) +
    (invoiceData.bankAccount ? 16 : 0) +
    (paymentUrl ? 42 : 0);
  const footerReserve = Math.min(28 + Math.max(notesHeight, paymentHeight) + 4, 180);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.logoSection}>
            {companyLogo && (
              <Image
                src={companyLogo}
                style={styles.companyLogo}
                alt="Company Logo"
              />
            )}
            <Text style={styles.companyName}>
              {companyName || "Devesh Sharma"}
            </Text>
          </View>

          <View style={styles.invoiceTitleSection}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
          </View>

          <View style={styles.invoiceDetails}>
            <Text style={styles.invoiceNumber}>
              Invoice No.: {invoiceNumber || "#405"}
            </Text>
            <Text style={styles.invoiceDate}>
              Date: {invoiceDate || "16th July 2025"}
            </Text>
            <Text style={styles.dueDate}>Due: {dueDate || "5th Aug 2025"}</Text>
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

        {/* Bill To and From Section */}
        <View style={styles.contentSection}>
          <View style={styles.billToSection}>
            <Text style={styles.sectionTitle}>Bill to:</Text>
            <Text style={styles.text}>{clientName || "Client Name"}</Text>
            <Text style={styles.text}>{clientEmail || "client@email.com"}</Text>
            {clientCustomFields.slice(0, 8).map(
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
            <Text style={styles.text}>{companyName || "Devesh Sharma"}</Text>
            <Text style={styles.text}>
              {companyEmail || "devesh2023@gmail.com"}
            </Text>
            {companyCustomFields.slice(0, 6).map(
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

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          {/* fixed: repeated at the top of the table on every continuation page */}
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

          {/* Table Rows */}
          {items && items.length > 0 ? (
            segments.map((segment, segIndex) =>
              segment.partition ? (
                <View key={segment.key} style={styles.partitionBox}>
                  {segment.rows.map((row, i) =>
                    renderRow(row, { boxed: true, beforeTotal: segment.rows[i + 1]?.rowType === "partitionTotal" })
                  )}
                </View>
              ) : (
                <View
                  key={segment.key}
                  style={segIndex > 0 ? styles.looseBlockDetached : null}
                >
                  {segment.rows.map((row, i) =>
                    renderRow(row, {
                      loose: true,
                      looseFirst: segIndex > 0 && i === 0,
                      looseLast: i === segment.rows.length - 1,
                    })
                  )}
                </View>
              )
            )
          ) : (
            // Default row if no items
            <View style={[styles.tableRow, styles.looseRow, styles.looseRowLast]}>
              <Text
                style={[
                  styles.tableCell,
                  invoiceData.includeDescription
                    ? styles.itemNameCell
                    : styles.itemNameCellWide, growCol,
                ]}
              >
                1 Logo Design
              </Text>
              {invoiceData.includeDescription && (
                <Text style={[styles.tableCell, styles.descriptionCell, growCol]}>
                  Professional logo design
                </Text>
              )}
              {showQuantity && (
                <Text
                  style={[
                    styles.tableCell,
                    invoiceData.includeDescription
                      ? styles.qtyCell
                      : styles.qtyCellWide,
                  ]}
                >
                  1
                </Text>
              )}
              {showQuantity && (
                <Text
                  style={[
                    styles.tableCell,
                    invoiceData.includeDescription
                      ? styles.priceCell
                      : styles.priceCellWide,
                  ]}
                >
                  $1,200
                </Text>
              )}
              <Text
                style={[
                  styles.tableCell,
                  invoiceData.includeDescription
                    ? styles.totalCell
                    : styles.totalCellWide,
                ]}
              >
                $1,200
              </Text>
            </View>
          )}
        </View>

        {/* Totals Section */}
        {/* minPresenceAhead: when the notes/payment block can't start below the
            totals, move the totals to the next page with it instead of leaving
            that block alone on a trailing page */}
        <View style={styles.totalsContainer} wrap={false} minPresenceAhead={footerReserve}>
          <View style={styles.totalsSection}>
            {partitionTotals.length > 0 && (
              <View style={styles.partitionTotalsBlock}>
                {partitionTotals.map((p) => (
                  <View key={p.id} style={styles.partitionSummaryRow}>
                    <Text style={styles.partitionSummaryLabel}>{p.name || "Untitled partition"}</Text>
                    <Text style={styles.partitionSummaryValue}>${p.total.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
            {showSubtotal && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Discount ({discountRate || 0}%):
              </Text>
              <Text style={styles.totalValue}>
                {discountRate > 0 ? `-$${discountAmount.toFixed(2)}` : "$0.00"}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({taxRate || 0}%):</Text>
              <Text style={styles.totalValue}>
                {taxRate > 0 ? `$${taxAmount.toFixed(2)}` : "$0.00"}
              </Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text
                style={[
                  styles.grandTotalValue,
                  // Step down only for very long amounts so it stays on one line
                  total.toFixed(2).length > 11 ? { fontSize: 20 } : null,
                ]}
              >
                ${total.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer Section */}
        <View style={styles.footerSection}>
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle} minPresenceAhead={30}>Notes:</Text>
            <Text style={styles.notesText}>
              {notes ||
                "Thank you for your business! We appreciate your trust in our services and look forward to working with you again."}
            </Text>
          </View>
          {(invoiceData.bankName || invoiceData.bankAccount || paymentUrl) && (
            <View style={styles.paymentSection}>
              <Text style={styles.paymentTitle} minPresenceAhead={30}>
                Payment Information:
              </Text>
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
                <View style={{ marginTop: 4, alignItems: "flex-end" }} wrap={false}>
                  <Link src={paymentUrl} style={styles.payButtonLink}>
                    <View style={styles.payButton}>
                      <Text style={styles.payButtonText}>{paymentLinkText}</Text>
                      <Svg viewBox="0 0 10 10" style={styles.payButtonIcon}>
                        <Path
                          d="M1 5 H8.6 M5.4 1.8 L8.6 5 L5.4 8.2"
                          stroke="#FFFFFF"
                          strokeWidth={1.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </Svg>
                    </View>
                  </Link>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Terms Section */}
        {terms && (
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle} minPresenceAhead={30}>
              Terms and Conditions:
            </Text>
            <Text style={styles.termsText}>{terms}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
};

export default YellowClassicTemplate;
