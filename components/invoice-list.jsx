"use client";

import { useToast } from "@/contexts/ToastContext";
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/ui/loading-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Edit,
  Trash2,
  Search,
  X,
  Copy,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_TEMPLATE, getTemplateById } from "@/app/utils/templates/registry";
import { renderInvoicePdfBlob } from "@/app/utils/pdfRenderer";
import { prepareInvoiceDataForPDF } from "@/app/utils/imageToBase64";
import {
  calculateItemsSubtotal,
  prepareItemsForPDF,
} from "@/app/utils/invoiceItems";
import { useInvoices } from "@/contexts/InvoiceContext";
import { Spinner } from "@/components/ui/spinner";

export default function InvoiceList({ clientId, onEditInvoice }) {
  const {
    getInvoicesForClient,
    loading,
    loadingMore,
    searchLoading,
    pagination,
    error,
    fetchInvoices,
    loadMoreInvoices,
    deleteInvoice,
    deleteAllInvoices,
    updateInvoiceStatus,
    duplicateInvoice,
  } = useInvoices();
  const invoicesContainerRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState(null);
  const { toast } = useToast();

  // Get invoices from context
  const rawInvoices = getInvoicesForClient(clientId);
  const invoices = useMemo(() => rawInvoices, [rawInvoices]);
  const isLoading = loading[clientId] || false;
  const isLoadingMore = loadingMore[clientId] || false;
  const isSearchLoading = searchLoading[clientId] || false;
  const fetchError = error[clientId] || null;
  const clientPagination = pagination[clientId] || { hasMore: false };

  // Load invoices when the client changes (uses the 2-minute cache if fresh)
  useEffect(() => {
    if (clientId) {
      fetchInvoices(clientId);
    }
  }, [clientId, fetchInvoices]);

  // Remember which search was last sent so the debounce below only
  // fires when the user actually changes a filter
  const lastSearchKeyRef = useRef(null);

  // Debounced search effect to prevent excessive API calls
  useEffect(() => {
    if (!clientId) return;

    const searchKey = `${clientId}|${searchTerm}|${searchDate}|${searchStatus}`;
    const isEmptySearch = !searchTerm && !searchDate && !searchStatus;
    if (lastSearchKeyRef.current === null || lastSearchKeyRef.current.split("|")[0] !== clientId) {
      // First render for this client: the effect above already loads the list
      lastSearchKeyRef.current = searchKey;
      if (isEmptySearch) return;
    }
    if (lastSearchKeyRef.current === searchKey && isEmptySearch) return;

    const timeoutId = setTimeout(() => {
      lastSearchKeyRef.current = searchKey;
      const searchParams = {
        search: searchTerm,
        date: searchDate,
        status: searchStatus
      };
      
      fetchInvoices(clientId, false, true, searchParams); // Reset pagination for search
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [clientId, searchTerm, searchDate, searchStatus, fetchInvoices]);

  // Use invoices directly since filtering is now done server-side
  const filteredInvoices = invoices;

  const clearSearch = () => {
    setSearchTerm("");
    setSearchDate("");
    setSearchStatus("");
  };

  const handleDownloadPDF = async (invoice) => {
    try {
      const invoiceData = invoice.data || {};

      // Prepare the invoice data for PDF generation
      const pdfData = {
        companyName: invoiceData.companyName || "",
        companyEmail: invoiceData.companyEmail || "",
        companyLogo: invoiceData.companyLogo || "",
        companyCustomFields: invoiceData.companyCustomFields || [],
        clientName: invoiceData.clientName || "",
        clientEmail: invoiceData.clientEmail || "",
        clientCustomFields: invoiceData.clientCustomFields || [],
        invoiceNumber: invoiceData.invoiceNumber || "",
        invoiceDate: invoiceData.issueDate || invoiceData.invoiceDate || "",
        dueDate: invoiceData.dueDate || "",
        status: invoiceData.status || "PENDING",
        items: prepareItemsForPDF(invoiceData.items),
        includeDescription: invoiceData.includeDescription || false,
        includeQuantity: invoiceData.includeQuantity !== false,
        taxRate: invoiceData.taxRate || 0,
        discountRate: invoiceData.discountRate || 0,
        notes: invoiceData.notes || "Thank you for your business!",
        terms: invoiceData.terms || "",
        bankName: invoiceData.bankName || "",
        bankAccount: invoiceData.bankAccount || "",
        paymentLink: invoiceData.paymentLink || "",
        paymentLinkText: invoiceData.paymentLinkText || "",
      };

      // Convert company logo URL to base64 for PDF generation
      console.log('🚀 About to prepare PDF data with logo:', pdfData.companyLogo);
      const preparedPdfData = await prepareInvoiceDataForPDF(pdfData);
      console.log('🚀 PDF data prepared, logo is now:', preparedPdfData.companyLogo?.substring(0, 50) + '...');

      // Generate and download the PDF using selected template
      const selectedTemplate = invoiceData.selectedTemplate || DEFAULT_TEMPLATE;
      const blob = await renderInvoicePdfBlob(selectedTemplate, preparedPdfData);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoiceData.invoiceNumber || "unknown"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log("PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Couldn't generate the PDF. Please try again.");
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    setInvoiceToDelete(invoiceId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (invoiceToDelete && !isDeleting) {
      setIsDeleting(true);
      try {
        await deleteInvoice(invoiceToDelete, clientId);
        setDeleteDialogOpen(false);
        setInvoiceToDelete(null);
        toast.success("Invoice deleted");
      } catch (error) {
        console.error("Error deleting invoice:", error);
        toast.error("Couldn't delete the invoice. Please try again.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (!clientId) return;

    try {
      setIsDeleting(true);
      await deleteAllInvoices(clientId);
      setDeleteAllDialogOpen(false);
      toast.success("All invoices deleted");
    } catch (error) {
      console.error("Error deleting all invoices:", error);
      toast.error("Couldn't delete the invoices. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateInvoice = async (invoiceId) => {
    try {
      await duplicateInvoice(invoiceId, clientId);
      toast.success("Invoice duplicated");
    } catch (error) {
      console.error("Error duplicating invoice:", error);
      toast.error("Couldn't duplicate the invoice. Please try again.");
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      await updateInvoiceStatus(invoiceId, newStatus, clientId);
      toast.success(`Marked as ${newStatus.charAt(0) + newStatus.slice(1).toLowerCase()}`);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      toast.error("Couldn't update the status. Please try again.");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    // Read plain YYYY-MM-DD dates as local dates (not UTC) so the day doesn't shift
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    const date = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateInvoiceTotal = (invoice) => {
    const invoiceData = invoice.data || {};
    if (!invoiceData.items || !Array.isArray(invoiceData.items)) return 0;

    const subtotal = calculateItemsSubtotal(invoiceData.items);

    const taxAmount = (subtotal * (invoiceData.taxRate || 0)) / 100;
    const discountAmount = (subtotal * (invoiceData.discountRate || 0)) / 100;

    return subtotal + taxAmount - discountAmount;
  };

  const getStatusBadge = (invoice) => {
    const invoiceData = invoice.data || {};
    const status = invoiceData.status || "PENDING";

    const getStatusColor = (status) => {
      switch (status) {
        case "PAID":
          return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
        case "DRAFT":
          return "border-border bg-muted text-muted-foreground";
        case "SENT":
        case "AVAILABLE":
          return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400";
        case "VIEWED":
          return "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400";
        case "PENDING":
          return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
        case "OVERDUE":
          return "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-400";
        case "CANCELLED":
          return "border-destructive/25 bg-destructive/10 text-destructive";
        default:
          return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
      }
    };

    const formatStatusText = (status) => {
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    };

    return (
      <Badge variant="outline" className={getStatusColor(status)}>
        {formatStatusText(status)}
      </Badge>
    );
  };

  const getTemplateName = (invoice) => {
    const invoiceData = invoice.data || {};
    const templateId = invoiceData.selectedTemplate || DEFAULT_TEMPLATE;
    const template = getTemplateById(templateId);
    return template.name || "Unknown Template";
  };

  const hasFilters = Boolean(searchTerm || searchDate || searchStatus);
  // Use the loaded list when everything is loaded (stays right after local adds/deletes)
  const totalInvoices = clientPagination.hasMore
    ? clientPagination.totalCount ?? invoices.length
    : invoices.length;
  const STATUS_OPTIONS = [
    { value: "PENDING", label: "Pending" },
    { value: "PAID", label: "Paid" },
    { value: "OVERDUE", label: "Overdue" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  // Runs a row action while showing a spinner on that row's menu button
  const runRowAction = async (invoiceId, action) => {
    setBusyInvoiceId(invoiceId);
    try {
      await action();
    } finally {
      setBusyInvoiceId(null);
    }
  };

  if (fetchError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-destructive">Couldn&apos;t load invoices.</p>
          <Button variant="outline" size="sm" onClick={() => fetchInvoices(clientId, true)}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="gap-0 py-0">
        {/* Header + toolbar */}
        <div className="flex flex-col gap-4 border-b p-4 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold leading-none">Invoices</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {isLoading
                  ? "Loading invoices…"
                  : `${totalInvoices} invoice${totalInvoices === 1 ? "" : "s"} for this client`}
              </p>
            </div>
            {invoices.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteAllDialogOpen(true)}
              >
                <Trash2 /> Delete all
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search invoice number"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                aria-label="Search invoices by number"
              />
            </div>
            <Input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="sm:w-44"
              aria-label="Filter by date"
            />
            <Select
              value={searchStatus || "ALL"}
              onValueChange={(v) => setSearchStatus(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="sm:w-40" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                <X /> Reset
              </Button>
            )}
            {isSearchLoading && <Spinner className="size-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3 p-4 md:p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">{hasFilters ? "No matching invoices" : "No invoices yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Try a different search or reset the filters."
                : "Create the first invoice for this client with “New invoice”."}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearSearch}>
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <div ref={invoicesContainerRef} className="px-2 pb-2 md:px-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Invoice</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead className="hidden sm:table-cell">Due</TableHead>
                  <TableHead className="hidden lg:table-cell">Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[88px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const data = invoice.data || {};
                  const itemCount = Array.isArray(data.items) ? data.items.length : 0;
                  const isBusy = busyInvoiceId === invoice.id;
                  return (
                    <TableRow
                      key={invoice.id}
                      // The whole row opens the invoice for editing
                      onClick={() => onEditInvoice(invoice)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          onEditInvoice(invoice);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Edit ${data.invoiceNumber || "invoice"}`}
                      className={`group cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none ${isBusy ? "opacity-70" : ""}`}
                    >
                      <TableCell>
                        <span className="font-medium underline-offset-4 group-hover:underline">
                          {data.invoiceNumber || "Invoice"}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {itemCount} item{itemCount === 1 ? "" : "s"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDate(data.issueDate || data.invoiceDate) || "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDate(data.dueDate) || "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {getTemplateName(invoice)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(calculateInvoiceTotal(invoice))}
                      </TableCell>
                      <TableCell>
                        {/* Keep action clicks from also opening the row */}
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Download PDF"
                            aria-label={`Download ${data.invoiceNumber || "invoice"} as PDF`}
                            disabled={isBusy}
                            onClick={() => runRowAction(invoice.id, () => handleDownloadPDF(invoice))}
                          >
                            <Download />
                          </Button>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                disabled={isBusy}
                                aria-label={`More actions for ${data.invoiceNumber || "invoice"}`}
                              >
                                {isBusy ? <Spinner className="size-4" /> : <MoreHorizontal />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48"
                              // Menu renders in a portal, but React still bubbles its clicks to the row
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem onClick={() => onEditInvoice(invoice)}>
                                <Edit className="mr-2 size-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  runRowAction(invoice.id, () => handleDuplicateInvoice(invoice.id))
                                }
                              >
                                <Copy className="mr-2 size-4" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                Mark as
                              </DropdownMenuLabel>
                              <DropdownMenuRadioGroup
                                value={data.status || "PENDING"}
                                onValueChange={(value) =>
                                  value !== (data.status || "PENDING") &&
                                  runRowAction(invoice.id, () => handleStatusChange(invoice.id, value))
                                }
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <DropdownMenuRadioItem key={s.value} value={s.value}>
                                    {s.label}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteInvoice(invoice.id)}
                              >
                                <Trash2 className="mr-2 size-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {clientPagination.hasMore && !hasFilters && (
              <div className="flex justify-center py-3">
                <Button
                  variant="outline"
                  size="sm"
                  loading={isLoadingMore}
                  onClick={() => loadMoreInvoices(clientId)}
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Delete one */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !isDeleting && (open ? setDeleteDialogOpen(true) : cancelDelete())}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete this invoice?</DialogTitle>
            <DialogDescription>
              This permanently deletes the invoice. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete all */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={(open) => !isDeleting && setDeleteAllDialogOpen(open)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete all invoices?</DialogTitle>
            <DialogDescription>
              This permanently deletes all {totalInvoices} invoices for
              this client. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll} loading={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
