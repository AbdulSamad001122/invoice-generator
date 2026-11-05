"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/ui/loading-button";
import { useToast } from "@/contexts/ToastContext";
import { normalizePaymentUrl } from "@/app/utils/paymentLink";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  Plus,
  Package,
  Check,
  ArrowLeft,
  CornerDownRight,
  ImagePlus,
  Upload,
} from "lucide-react";
import { useItems } from "@/contexts/ItemContext";
import { getDefaultTemplate } from "@/app/utils/templates/registry";
import { renderInvoicePdfBlob, preloadPdfRenderer } from "@/app/utils/pdfRenderer";
import { prepareInvoiceDataForPDF } from "@/app/utils/imageToBase64";
import {
  getSubItems,
  hasSubItems,
  calculateItemAmount,
  calculateLineAmount,
  calculateItemsSubtotal,
  prepareItemsForPDF,
} from "@/app/utils/invoiceItems";
import TemplateSelector from "@/components/template-selector";
import axios from "axios";
import { Spinner } from "@/components/ui/spinner";

export default function InvoiceForm({
  invoice,
  onInvoiceCreated,
  onCancel,
  preselectedClient,
}) {
  const router = useRouter();

  const handleBackToDashboard = () => {
    router.push("/");
  };
  const { getItemsForClient } = useItems();
  const [showSavedItemsDialog, setShowSavedItemsDialog] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);

  const [formData, setFormData] = useState(() => {
    // If editing an invoice, extract data from the data field
    const invoiceData = invoice?.data || {};

    return {
      invoiceNumber: invoiceData?.invoiceNumber || "",
      issueDate:
        invoiceData?.issueDate || new Date().toISOString().split("T")[0],
      dueDate: invoiceData?.dueDate || "",
      status: invoiceData?.status || "PENDING",
      // Company Information
      companyName: invoiceData?.companyName || "",
      companyEmail: invoiceData?.companyEmail || "",
      companyLogo: invoiceData?.companyLogo || "",
      companyCustomFields: invoiceData?.companyCustomFields || [],
      // Client Information
      clientName: invoiceData?.clientName || "",
      clientEmail: invoiceData?.clientEmail || "",
      clientCustomFields: invoiceData?.clientCustomFields || [],
      // Items and Calculations
      items: invoiceData?.items || [
        { itemName: "", description: "", quantity: 1, rate: 0 },
      ],
      includeDescription: invoiceData?.includeDescription || false,
      includeQuantity: invoiceData?.includeQuantity !== false,
      taxRate: invoiceData?.taxRate || 0,
      discountRate: invoiceData?.discountRate || 0,
      // Additional Information
      notes: invoiceData?.notes || "",
      terms: invoiceData?.terms || "",
      // Payment Information
      bankName: invoiceData?.bankName || "",
      bankAccount: invoiceData?.bankAccount || "",
      paymentLink: invoiceData?.paymentLink || "",
      paymentLinkText: invoiceData?.paymentLinkText || "",
      // Template Selection
      selectedTemplate: invoiceData?.selectedTemplate || getDefaultTemplate(),
    };
  });

  // Update form data when invoice prop changes
  useEffect(() => {
    if (invoice) {
      const invoiceData = invoice.data || {};
      setFormData({
        invoiceNumber: invoiceData?.invoiceNumber || "",
        issueDate:
          invoiceData?.issueDate || new Date().toISOString().split("T")[0],
        dueDate: invoiceData?.dueDate || "",
        status: invoiceData?.status || "PENDING",
        // Company Information
        companyName: invoiceData?.companyName || "",
        companyEmail: invoiceData?.companyEmail || "",
        companyLogo: invoiceData?.companyLogo || "",
        companyCustomFields: invoiceData?.companyCustomFields || [],
        // Client Information
        clientName: invoiceData?.clientName || "",
        clientEmail: invoiceData?.clientEmail || "",
        clientCustomFields: invoiceData?.clientCustomFields || [],
        // Items and Calculations
        items: invoiceData?.items || [
          { itemName: "", description: "", quantity: 1, rate: 0 },
        ],
        includeDescription: invoiceData?.includeDescription || false,
        includeQuantity: invoiceData?.includeQuantity !== false,
        taxRate: invoiceData?.taxRate || 0,
        discountRate: invoiceData?.discountRate || 0,
        // Additional Information
        notes: invoiceData?.notes || "",
        terms: invoiceData?.terms || "",
        // Payment Information
        bankName: invoiceData?.bankName || "",
        bankAccount: invoiceData?.bankAccount || "",
        paymentLink: invoiceData?.paymentLink || "",
        paymentLinkText: invoiceData?.paymentLinkText || "",
        // Template Selection
        selectedTemplate: invoiceData?.selectedTemplate || getDefaultTemplate(),
      });
    }
  }, [invoice]);

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef(null);
  const { toast } = useToast();

  // Download the PDF code in the background so Preview/Download are instant
  useEffect(() => {
    preloadPdfRenderer();
  }, []);

  const [isLoadingAutoData, setIsLoadingAutoData] = useState(false);
  const [isLoadingCompanyProfile, setIsLoadingCompanyProfile] = useState(false);
  const [showStatusOnPDF, setShowStatusOnPDF] = useState(false);
  const [defaultDueDays, setDefaultDueDays] = useState(30);

  // Auto-generate invoice number based on client's previous invoices
  useEffect(() => {
    const generateInvoiceNumber = async () => {
      if (preselectedClient && preselectedClient.id && !invoice) {
        setIsLoadingAutoData(true);
        try {
          // Generate next invoice number using the new utility function
          const response = await axios.post('/api/generateInvoiceNumber', {
            clientId: preselectedClient.id
          });
          
          const nextInvoiceNumber = response.data.invoiceNumber;

          // Update form data with auto-generated invoice number
          setFormData((prev) => ({
            ...prev,
            invoiceNumber: nextInvoiceNumber,
            clientName: preselectedClient.name || "",
            clientEmail: preselectedClient.email || "",
          }));
        } catch (error) {
          console.error("Error generating invoice number:", error);
          // Fallback to INV-1 if there's an error
          setFormData((prev) => ({
            ...prev,
            invoiceNumber: "INV-1",
            clientName: preselectedClient.name || "",
            clientEmail: preselectedClient.email || "",
          }));
        } finally {
          setIsLoadingAutoData(false);
        }
      }
    };

    generateInvoiceNumber();
  }, [preselectedClient, invoice]);

  // Load available items when client changes
  useEffect(() => {
    const loadAvailableItems = async () => {
      if (preselectedClient && preselectedClient.id) {
        try {
          const items = await getItemsForClient(preselectedClient.id);
          setAvailableItems(items);
        } catch (error) {
          console.error("Error loading available items:", error);
          setAvailableItems([]);
        }
      } else {
        setAvailableItems([]);
      }
    };

    loadAvailableItems();
    // Only refetch when the client changes (getItemsForClient is a new function every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedClient?.id]);

  // Auto-fetch company profile data for new invoices
  useEffect(() => {
    const fetchCompanyProfile = async () => {
      // Only fetch for new invoices (not when editing existing ones)
      if (invoice) return;
      
      setIsLoadingCompanyProfile(true);
      try {
        const response = await fetch('/api/company-profile');
        if (response.ok) {
          const result = await response.json();
          console.log('Company profile API response:', result);
          if (result.success && result.data) {
            const companyDefaultDueDays = result.data.defaultDueDays || 30;
            console.log('Setting defaultDueDays to:', companyDefaultDueDays);
            setDefaultDueDays(companyDefaultDueDays);
            
            const issueDate = new Date();
            const calculatedDueDate = new Date(issueDate);
            calculatedDueDate.setDate(calculatedDueDate.getDate() + companyDefaultDueDays);
            console.log('Calculated due date:', calculatedDueDate.toISOString().split('T')[0]);
            
            setFormData(prev => ({
              ...prev,
              companyName: result.data.companyName || prev.companyName,
              companyEmail: result.data.companyEmail || prev.companyEmail,
              companyLogo: result.data.companyLogo || prev.companyLogo,
              bankName: result.data.bankName || prev.bankName,
              bankAccount: result.data.bankAccount || prev.bankAccount,
              dueDate: prev.dueDate || calculatedDueDate.toISOString().split('T')[0],
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching company profile:', error);
        // Silently fail - user can still manually enter company data
      } finally {
        setIsLoadingCompanyProfile(false);
      }
    };

    fetchCompanyProfile();
  }, [invoice]); // Only run when invoice prop changes

  const validateForm = () => {
    const newErrors = {};

    if (!formData.invoiceNumber.trim()) {
      newErrors.invoiceNumber = "Invoice number is required";
    }

    if (!formData.issueDate) {
      newErrors.issueDate = "Issue date is required";
    }

    if (!formData.dueDate) {
      newErrors.dueDate = "Due date is required";
    }

    // Company validation
    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }

    if (!formData.companyEmail.trim()) {
      newErrors.companyEmail = "Company email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.companyEmail)) {
      newErrors.companyEmail = "Please enter a valid email address";
    }

    // Client validation
    if (!formData.clientName.trim()) {
      newErrors.clientName = "Client name is required";
    }

    // Client email is optional (clients can be saved without one); check the format if given
    if (formData.clientEmail.trim() && !/\S+@\S+\.\S+/.test(formData.clientEmail)) {
      newErrors.clientEmail = "Please enter a valid email address";
    }

    // Payment link (optional) must be a valid web address
    if (formData.paymentLink?.trim() && !normalizePaymentUrl(formData.paymentLink)) {
      newErrors.paymentLink = "Enter a valid link, e.g. https://pay.example.com/invoice";
    }

    // Tax and discount validation
    if (formData.taxRate < 0 || formData.taxRate > 100) {
      newErrors.taxRate = "Tax rate must be between 0 and 100";
    }

    if (formData.discountRate < 0 || formData.discountRate > 100) {
      newErrors.discountRate = "Discount rate must be between 0 and 100";
    }

    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    } else {
      const validateLine = (line, prefix) => {
        if (!(line.itemName || "").trim()) {
          newErrors[`${prefix}_itemName`] = "Item name is required";
        }
        if (formData.includeQuantity !== false && (!line.quantity || line.quantity <= 0)) {
          newErrors[`${prefix}_quantity`] = "Quantity must be greater than 0";
        }
        if (!line.rate || line.rate <= 0) {
          newErrors[`${prefix}_rate`] = "Rate must be greater than 0";
        }
      };

      formData.items.forEach((item, index) => {
        if (hasSubItems(item)) {
          // Group item: only the name is required; its price comes from sub-items
          if (!(item.itemName || "").trim()) {
            newErrors[`item_${index}_itemName`] = "Item name is required";
          }
          getSubItems(item).forEach((sub, subIndex) =>
            validateLine(sub, `item_${index}_sub_${subIndex}`)
          );
        } else {
          validateLine(item, `item_${index}`);
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Saves the invoice. Returns the API response data, or null if nothing was saved.
  const saveInvoice = async () => {
    const invoicePayload = {
      ...formData,
      clientId: preselectedClient?.id || null,
    };
    const response =
      invoice && invoice.id
        ? await axios.put(`/api/invoices?id=${invoice.id}`, invoicePayload)
        : await axios.post("/api/createInvoice", invoicePayload);
    return response.data;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSaving) return; // ignore double clicks / repeated Enter presses

    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setIsSaving(true);
    try {
      const data = await saveInvoice();
      toast.success(invoice ? "Invoice updated" : "Invoice created");
      onInvoiceCreated(data);
    } catch (error) {
      console.error("Error saving invoice:", error);
      // Keep the form open so nothing the user typed is lost
      toast.error(
        error?.response?.data?.error ||
          (invoice ? "Couldn't update the invoice. Please try again." : "Couldn't create the invoice. Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      
      // Auto-calculate due date when issue date changes
      if (field === 'issueDate' && value && defaultDueDays) {
        console.log('Issue date changed to:', value, 'defaultDueDays:', defaultDueDays);
        const issueDate = new Date(value);
        const calculatedDueDate = new Date(issueDate);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + defaultDueDays);
        const dueDateString = calculatedDueDate.toISOString().split('T')[0];
        console.log('Auto-calculated due date:', dueDateString);
        newData.dueDate = dueDateString;
      }
      
      return newData;
    });
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData((prev) => ({ ...prev, items: newItems }));

    // Clear error when user starts typing
    const errorKey = `item_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: "" }));
    }
  };

  // Turning quantity off treats every line (and sub-item) as quantity 1,
  // so the amount is just the price and totals stay correct.
  const handleQuantityToggle = (checked) => {
    // When hiding quantity, fold quantity × rate into the price so every line
    // amount (and the invoice total) stays exactly the same.
    const round2 = (n) => Math.round(n * 100) / 100;
    const fold = (line) => {
      const qty = Number(line.quantity) || 1;
      return qty === 1
        ? { ...line, quantity: 1 }
        : { ...line, quantity: 1, rate: round2(qty * (Number(line.rate) || 0)) };
    };
    const changed = !checked && formData.items.some(
      (item) =>
        (Number(item.quantity) || 1) !== 1 ||
        (item.subItems || []).some((sub) => (Number(sub.quantity) || 1) !== 1)
    );
    setFormData((prev) => ({
      ...prev,
      includeQuantity: checked,
      items: checked
        ? prev.items
        : prev.items.map((item) => ({
            ...fold(item),
            ...(Array.isArray(item.subItems) ? { subItems: item.subItems.map(fold) } : {}),
          })),
    }));
    if (changed) {
      toast.info("Quantities were folded into the prices, so the totals stay the same.");
    }
    if (!checked) {
      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(next)
          .filter((k) => k.endsWith("_quantity"))
          .forEach((k) => delete next[k]);
        return next;
      });
    }
  };

  const clearErrors = (keys) => {
    if (keys.some((key) => errors[key])) {
      setErrors((prev) => {
        const next = { ...prev };
        keys.forEach((key) => delete next[key]);
        return next;
      });
    }
  };

  const addSubItem = (index) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const item = newItems[index];
      const existing = getSubItems(item);
      newItems[index] = {
        ...item,
        subItems: [
          ...existing,
          // The first sub-item inherits the parent's price so nothing is lost
          existing.length === 0 && item.rate > 0
            ? {
                itemName: "",
                description: "",
                quantity: item.quantity || 1,
                rate: item.rate,
              }
            : { itemName: "", description: "", quantity: 1, rate: 0 },
        ],
      };
      return { ...prev, items: newItems };
    });
    clearErrors([`item_${index}_quantity`, `item_${index}_rate`]);
  };

  const handleSubItemChange = (index, subIndex, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const subItems = [...getSubItems(newItems[index])];
      subItems[subIndex] = { ...subItems[subIndex], [field]: value };
      newItems[index] = { ...newItems[index], subItems };
      return { ...prev, items: newItems };
    });
    clearErrors([`item_${index}_sub_${subIndex}_${field}`]);
  };

  const removeSubItem = (index, subIndex) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const subItems = getSubItems(newItems[index]).filter(
        (_, i) => i !== subIndex
      );
      const { subItems: _old, ...rest } = newItems[index];
      newItems[index] = subItems.length > 0 ? { ...rest, subItems } : rest;
      return { ...prev, items: newItems };
    });
    // Sub-item indexes shift, so drop all sub-item errors for this item
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next)
        .filter((key) => key.startsWith(`item_${index}_sub_`))
        .forEach((key) => delete next[key]);
      return next;
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { itemName: "", description: "", quantity: 1, rate: 0 },
      ],
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, items: newItems }));
    }
  };

  const addSavedItem = (savedItem) => {
    const newItem = {
      itemName: savedItem.name,
      description: savedItem.description || "",
      quantity: 1,
      rate: Number(savedItem.price),
    };

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const handleSavedItemSelect = (savedItem) => {
    addSavedItem(savedItem);
    setShowSavedItemsDialog(false);
  };

  // Custom field management functions
  const addCustomField = (fieldType) => {
    const fieldKey = `${fieldType}CustomFields`;
    setFormData((prev) => {
      // Limit custom fields to prevent memory issues (max 20 fields per type)
      if (prev[fieldKey].length >= 20) {
        toast.warning(
          `Maximum of 20 custom fields allowed for ${fieldType} information.`
        );
        return prev;
      }
      return {
        ...prev,
        [fieldKey]: [...prev[fieldKey], { name: "", value: "" }],
      };
    });
  };

  const removeCustomField = (fieldType, index) => {
    const fieldKey = `${fieldType}CustomFields`;
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey].filter((_, i) => i !== index),
    }));
  };

  const handleCustomFieldChange = (fieldType, index, field, value) => {
    const fieldKey = `${fieldType}CustomFields`;

    // Limit field value length to prevent memory issues (max 500 characters)
    if (value.length > 500) {
      toast.warning(`Custom field ${field} cannot exceed 500 characters.`);
      return;
    }

    setFormData((prev) => {
      const newFields = [...prev[fieldKey]];
      newFields[index] = { ...newFields[index], [field]: value };
      return { ...prev, [fieldKey]: newFields };
    });
  };

  const calculateTotal = () => {
    return calculateItemsSubtotal(formData.items);
  };

  const generateInvoiceData = () => {
    return {
      companyName: formData.companyName,
      companyEmail: formData.companyEmail,
      companyLogo: formData.companyLogo,
      companyCustomFields: formData.companyCustomFields,
      clientName: formData.clientName,
      clientEmail: formData.clientEmail,
      clientCustomFields: formData.clientCustomFields,
      invoiceNumber: formData.invoiceNumber,
      invoiceDate: formData.issueDate,
      dueDate: formData.dueDate,
      status: formData.status,
      showStatusOnPDF: showStatusOnPDF,
      items: prepareItemsForPDF(formData.items),
      includeDescription: formData.includeDescription,
      includeQuantity: formData.includeQuantity !== false,
      taxRate: formData.taxRate,
      discountRate: formData.discountRate,
      notes: formData.notes || "Thank you for your business!",
      terms: formData.terms,
      bankName: formData.bankName,
      bankAccount: formData.bankAccount,
      paymentLink: normalizePaymentUrl(formData.paymentLink) || "",
      paymentLinkText: formData.paymentLinkText,
      selectedTemplate: formData.selectedTemplate,
    };
  };

  const previewPDF = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const invoiceData = generateInvoiceData();
      // Convert company logo URL to base64 for PDF generation
      console.log('🚀 About to prepare PDF data with logo:', invoiceData.companyLogo);
      const preparedInvoiceData = await prepareInvoiceDataForPDF(invoiceData);
      console.log('🚀 PDF data prepared, logo is now:', preparedInvoiceData.companyLogo?.substring(0, 50) + '...');
      const blob = await renderInvoicePdfBlob(
        formData.selectedTemplate,
        preparedInvoiceData
      );
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, "_blank");

      // Clean up the URL after a delay to prevent memory leaks
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      // Also clean up if the window is closed
      if (newWindow) {
        const checkClosed = setInterval(() => {
          if (newWindow.closed) {
            URL.revokeObjectURL(url);
            clearInterval(checkClosed);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      toast.error("Couldn't generate the PDF preview. Please try again.");
    }
  };

  const downloadPDF = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const invoiceData = generateInvoiceData();
      // Convert company logo URL to base64 for PDF generation
      console.log('🚀 About to prepare PDF data with logo:', invoiceData.companyLogo);
      const preparedInvoiceData = await prepareInvoiceDataForPDF(invoiceData);
      console.log('🚀 PDF data prepared, logo is now:', preparedInvoiceData.companyLogo?.substring(0, 50) + '...');
      const blob = await renderInvoicePdfBlob(
        formData.selectedTemplate,
        preparedInvoiceData
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceData.invoiceNumber || "invoice"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Couldn't download the PDF. Please try again.");
    }
  };

  const handleCreateAndDownload = async () => {
    if (isSaving) return;
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setIsSaving(true);
    try {
      // First create/update the invoice
      const response = { data: await saveInvoice() };

      // Then download the PDF
      const invoiceData = generateInvoiceData();
      // Convert company logo URL to base64 for PDF generation
      const preparedInvoiceData = await prepareInvoiceDataForPDF(invoiceData);
      const blob = await renderInvoicePdfBlob(
        formData.selectedTemplate,
        preparedInvoiceData
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceData.invoiceNumber || "invoice"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Call the callback to update the UI
      onInvoiceCreated(response.data);
    } catch (error) {
      console.error("Error creating and downloading invoice:", error);
      toast.error("Couldn't create and download the invoice. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Back to the client (or dashboard) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel || handleBackToDashboard}
        disabled={isSaving}
        className="-ml-2 text-muted-foreground"
      >
        <ArrowLeft />
        {preselectedClient?.name ? `Back to ${preselectedClient.name}` : "Back to dashboard"}
      </Button>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">
            {invoice ? "Edit invoice" : "New invoice"}
            {formData.invoiceNumber && (
              <span className="ml-2 font-mono text-base font-normal text-muted-foreground">
                {formData.invoiceNumber}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {preselectedClient?.name
              ? `For ${preselectedClient.name}`
              : `Fill in the details below to ${invoice ? "update" : "create"} your invoice`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-6 [&_label+input]:mt-2 [&_label+textarea]:mt-2 [&_label+button[role=combobox]]:mt-2 [&_label+div]:mt-2"
          >
            {/* Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                <Input
                  id="invoiceNumber"
                  value={
                    isLoadingAutoData ? "Generating..." : formData.invoiceNumber
                  }
                  onChange={(e) =>
                    handleInputChange("invoiceNumber", e.target.value)
                  }
                  placeholder={
                    isLoadingAutoData
                      ? "Generating invoice number..."
                      : "INV-001"
                  }
                  className={`${errors.invoiceNumber ? "border-destructive" : ""} ${
                    isLoadingAutoData ? "bg-muted text-muted-foreground" : ""
                  }`}
                  disabled={isLoadingAutoData}
                  readOnly={isLoadingAutoData}
                />
                {errors.invoiceNumber && (
                  <p className="text-destructive text-sm mt-1">
                    {errors.invoiceNumber}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) =>
                    handleInputChange("issueDate", e.target.value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="dueDate" className="">
                  Due Date *
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange("dueDate", e.target.value)}
                  className={errors.dueDate ? "border-destructive" : ""}
                />
                {errors.dueDate && (
                  <p className="text-destructive text-sm mt-1">
                    {errors.dueDate}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Template Selection */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Template Selection</h3>
              <TemplateSelector
                selectedTemplate={formData.selectedTemplate}
                onTemplateChange={(templateId) =>
                  handleInputChange("selectedTemplate", templateId)
                }
                className="w-full"
              />
            </div>

            {/* PDF Options */}
            <div className="flex items-center space-x-2">
              <Switch
                id="showStatusOnPDF"
                checked={showStatusOnPDF}
                onCheckedChange={setShowStatusOnPDF}
              />
              <Label htmlFor="showStatusOnPDF" className="text-sm font-medium">
                Show status on downloaded PDF
              </Label>
            </div>

            <Separator />

            {/* Company Details */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Company Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={
                      isLoadingCompanyProfile ? "Generating..." : formData.companyName
                    }
                    onChange={(e) =>
                      handleInputChange("companyName", e.target.value)
                    }
                    placeholder={
                      isLoadingCompanyProfile
                        ? "Generating company name..."
                        : "Your Company Name"
                    }
                    className={`${errors.companyName ? "border-destructive" : ""} ${
                      isLoadingCompanyProfile ? "bg-muted text-muted-foreground" : ""
                    }`}
                    disabled={isLoadingCompanyProfile}
                    readOnly={isLoadingCompanyProfile}
                  />
                  {errors.companyName && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.companyName}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="companyEmail">Company Email *</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={
                      isLoadingCompanyProfile ? "Generating..." : formData.companyEmail
                    }
                    onChange={(e) =>
                      handleInputChange("companyEmail", e.target.value)
                    }
                    placeholder={
                      isLoadingCompanyProfile
                        ? "Generating company email..."
                        : "company@example.com"
                    }
                    className={`${errors.companyEmail ? "border-destructive" : ""} ${
                      isLoadingCompanyProfile ? "bg-muted text-muted-foreground" : ""
                    }`}
                    disabled={isLoadingCompanyProfile}
                    readOnly={isLoadingCompanyProfile}
                  />
                  {errors.companyEmail && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.companyEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyLogo" className="">
                    Company Logo
                  </Label>
                  {isLoadingCompanyProfile ? (
                    <div className="flex items-center space-x-2 p-2 bg-muted rounded border">
                      <Spinner className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-sm">Generating company logo...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      {/* Hidden native input, opened by the button below */}
                      <input
                        ref={logoInputRef}
                        id="companyLogo"
                        type="file"
                        accept="image/png,image/jpeg"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && !["image/png", "image/jpeg"].includes(file.type)) {
                            toast.error("Please choose a PNG or JPG image (PDFs can't show other formats).");
                            e.target.value = "";
                            return;
                          }
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              handleInputChange("companyLogo", event.target.result);
                            };
                            reader.readAsDataURL(file);
                          }
                          e.target.value = ""; // allow picking the same file again
                        }}
                      />
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50">
                        {formData.companyLogo ? (
                          <img
                            src={formData.companyLogo}
                            alt="Company logo preview"
                            className="size-full object-contain p-1"
                          />
                        ) : (
                          <ImagePlus className="size-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
                          >
                            <Upload />
                            {formData.companyLogo ? "Change logo" : "Upload logo"}
                          </Button>
                          {formData.companyLogo && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/80"
                              onClick={() => handleInputChange("companyLogo", "")}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">PNG or JPG. Square works best.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Custom Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Additional Company Information
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCustomField("company")}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Field
                  </Button>
                </div>
                {formData.companyCustomFields.map((field, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end"
                  >
                    <div>
                      <Label htmlFor={`companyField${index}Name`}>
                        Field Name
                      </Label>
                      <Input
                        id={`companyField${index}Name`}
                        value={field.name}
                        onChange={(e) =>
                          handleCustomFieldChange(
                            "company",
                            index,
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="e.g., Phone, Address, Website"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`companyField${index}Value`}>
                        Field Value
                      </Label>
                      <Input
                        id={`companyField${index}Value`}
                        value={field.value}
                        onChange={(e) =>
                          handleCustomFieldChange(
                            "company",
                            index,
                            "value",
                            e.target.value
                          )
                        }
                        placeholder="Enter value"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomField("company", index)}
                      className="flex items-center gap-2 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Client Details */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Client Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={
                      isLoadingAutoData
                        ? "Fetching client info..."
                        : formData.clientName
                    }
                    onChange={(e) =>
                      handleInputChange("clientName", e.target.value)
                    }
                    placeholder={
                      isLoadingAutoData ? "Loading client name..." : "John Doe"
                    }
                    className={`${errors.clientName ? "border-destructive" : ""} ${
                      isLoadingAutoData ? "bg-muted text-muted-foreground" : ""
                    }`}
                    disabled={isLoadingAutoData}
                    readOnly={isLoadingAutoData}
                  />
                  {errors.clientName && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.clientName}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="clientEmail" className="">
                    Client Email <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={
                      isLoadingAutoData
                        ? "Fetching client email..."
                        : formData.clientEmail
                    }
                    onChange={(e) =>
                      handleInputChange("clientEmail", e.target.value)
                    }
                    placeholder={
                      isLoadingAutoData
                        ? "Loading client email..."
                        : "john@example.com"
                    }
                    className={`${errors.clientEmail ? "border-destructive" : ""} ${
                      isLoadingAutoData ? "bg-muted text-muted-foreground" : ""
                    }`}
                    disabled={isLoadingAutoData}
                    readOnly={isLoadingAutoData}
                  />
                  {errors.clientEmail && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.clientEmail}
                    </p>
                  )}
                </div>
              </div>

              {/* Client Custom Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Additional Client Information
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCustomField("client")}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Field
                  </Button>
                </div>
                {formData.clientCustomFields.map((field, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end"
                  >
                    <div>
                      <Label htmlFor={`clientField${index}Name`}>
                        Field Name
                      </Label>
                      <Input
                        id={`clientField${index}Name`}
                        value={field.name}
                        onChange={(e) =>
                          handleCustomFieldChange(
                            "client",
                            index,
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="e.g., Phone, Address, Tax ID"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`clientField${index}Value`}>
                        Field Value
                      </Label>
                      <Input
                        id={`clientField${index}Value`}
                        value={field.value}
                        onChange={(e) =>
                          handleCustomFieldChange(
                            "client",
                            index,
                            "value",
                            e.target.value
                          )
                        }
                        placeholder="Enter value"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomField("client", index)}
                      className="flex items-center gap-2 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">Items</h3>
                <div className="flex gap-2">
                  {availableItems.length > 0 && (
                    <Dialog
                      open={showSavedItemsDialog}
                      onOpenChange={setShowSavedItemsDialog}
                    >
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <Package className="w-4 h-4 mr-2" />
                          Saved Items
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Select Saved Items</DialogTitle>
                          <DialogDescription>
                            Choose from your saved items to add to this invoice.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {availableItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                              onClick={() => handleSavedItemSelect(item)}
                            >
                              <div className="flex-1">
                                <h4 className="font-medium">{item.name}</h4>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {item.description}
                                  </p>
                                )}
                                <p className="text-sm font-semibold text-foreground">
                                  ${Number(item.price).toFixed(2)}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSavedItemSelect(item);
                                }}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button
                    type="button"
                    onClick={addItem}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>

              {/* Item field toggles */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="includeDescription"
                  checked={formData.includeDescription}
                  onCheckedChange={(checked) =>
                    handleInputChange("includeDescription", checked)
                  }
                />
                <Label
                  htmlFor="includeDescription"
                  className="text-sm font-medium"
                >
                  Include description field for items
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="includeQuantity"
                  checked={formData.includeQuantity !== false}
                  onCheckedChange={handleQuantityToggle}
                />
                <Label htmlFor="includeQuantity" className="text-sm font-medium">
                  Show quantity
                </Label>
              </div>
              </div>

              {errors.items && (
                <p className="text-destructive text-sm">{errors.items}</p>
              )}

              <div className="space-y-3">
                {formData.items.map((item, index) => {
                  const subItems = getSubItems(item);
                  const isGroup = subItems.length > 0;
                  const showQuantity = formData.includeQuantity !== false;
                  const nameSpan = formData.includeDescription
                    ? showQuantity ? "md:col-span-3" : "md:col-span-5"
                    : showQuantity ? "md:col-span-5" : "md:col-span-7";
                  const fieldError = (key) =>
                    errors[key] ? (
                      <p className="text-destructive text-sm mt-1">
                        {errors[key]}
                      </p>
                    ) : null;

                  return (
                    <div
                      key={index}
                      className={
                        isGroup
                          ? "rounded-lg border bg-muted/40 p-3 space-y-3"
                          : "space-y-2"
                      }
                    >
                      {/* Main item row */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className={nameSpan}>
                          <Label htmlFor={`itemName-${index}`}>
                            {isGroup ? "Item Group" : "Item Name"}
                          </Label>
                          <Input
                            id={`itemName-${index}`}
                            value={item.itemName}
                            onChange={(e) =>
                              handleItemChange(index, "itemName", e.target.value)
                            }
                            placeholder={
                              isGroup ? "e.g. Website Changes" : "Item name"
                            }
                            className={`${isGroup ? "font-semibold" : ""} ${
                              errors[`item_${index}_itemName`]
                                ? "border-destructive"
                                : ""
                            }`}
                          />
                          {fieldError(`item_${index}_itemName`)}
                        </div>

                        {formData.includeDescription && (
                          <div className="md:col-span-2">
                            <Label htmlFor={`description-${index}`}>
                              Description
                            </Label>
                            <Input
                              id={`description-${index}`}
                              value={item.description}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "description",
                                  e.target.value
                                )
                              }
                              placeholder="Item description"
                            />
                          </div>
                        )}

                        {isGroup ? (
                          <div className={`${showQuantity ? "md:col-span-4" : "md:col-span-2"} h-10 flex items-center text-sm text-muted-foreground`}>
                            Total of {subItems.length} sub-item
                            {subItems.length === 1 ? "" : "s"}
                          </div>
                        ) : (
                          <>
                            <div className={showQuantity ? "md:col-span-2" : "hidden"}>
                              <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                              <Input
                                id={`quantity-${index}`}
                                type="number"
                                min="1"
                                value={item.quantity}
                                onFocus={(e) => {
                                  if (e.target.value === "0") {
                                    e.target.value = "";
                                  }
                                }}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className={
                                  errors[`item_${index}_quantity`]
                                    ? "border-destructive"
                                    : ""
                                }
                              />
                              {fieldError(`item_${index}_quantity`)}
                            </div>

                            <div className="md:col-span-2">
                              <Label htmlFor={`rate-${index}`}>{showQuantity ? "Rate ($)" : "Price ($)"}</Label>
                              <Input
                                id={`rate-${index}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.rate}
                                onFocus={(e) => {
                                  if (e.target.value === "0") {
                                    e.target.value = "";
                                  }
                                }}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "rate",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className={
                                  errors[`item_${index}_rate`]
                                    ? "border-destructive"
                                    : ""
                                }
                              />
                              {fieldError(`item_${index}_rate`)}
                            </div>
                          </>
                        )}

                        <div className="md:col-span-2">
                          <Label>Amount</Label>
                          <div
                            className={`h-10 flex items-center px-3 border rounded-md ${
                              isGroup
                                ? "bg-muted font-semibold"
                                : "bg-muted/50"
                            }`}
                          >
                            ${calculateItemAmount(item).toFixed(2)}
                          </div>
                        </div>

                        <div className="md:col-span-1">
                          <Button
                            type="button"
                            onClick={() => removeItem(index)}
                            variant="outline"
                            size="sm"
                            disabled={formData.items.length === 1}
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Sub-item rows */}
                      {isGroup && (
                        <div className="ml-2 md:ml-4 pl-3 md:pl-4 border-l-2 border-border space-y-2">
                          {subItems.map((sub, subIndex) => {
                            const prefix = `item_${index}_sub_${subIndex}`;
                            return (
                              <div
                                key={subIndex}
                                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start"
                              >
                                <div className={`${nameSpan} flex items-start gap-2`}>
                                  <CornerDownRight className="w-4 h-4 mt-3 shrink-0 text-muted-foreground" />
                                  <div className="flex-1">
                                    <Input
                                      aria-label="Sub-item name"
                                      value={sub.itemName}
                                      onChange={(e) =>
                                        handleSubItemChange(
                                          index,
                                          subIndex,
                                          "itemName",
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g. Home page changes"
                                      className={
                                        errors[`${prefix}_itemName`]
                                          ? "border-destructive"
                                          : ""
                                      }
                                    />
                                    {fieldError(`${prefix}_itemName`)}
                                  </div>
                                </div>

                                {formData.includeDescription && (
                                  <div className="md:col-span-2">
                                    <Input
                                      aria-label="Sub-item description"
                                      value={sub.description}
                                      onChange={(e) =>
                                        handleSubItemChange(
                                          index,
                                          subIndex,
                                          "description",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Description"
                                    />
                                  </div>
                                )}

                                <div className={showQuantity ? "md:col-span-2" : "hidden"}>
                                  <Input
                                    aria-label="Sub-item quantity"
                                    type="number"
                                    min="1"
                                    value={sub.quantity}
                                    onFocus={(e) => {
                                      if (e.target.value === "0") {
                                        e.target.value = "";
                                      }
                                    }}
                                    onChange={(e) =>
                                      handleSubItemChange(
                                        index,
                                        subIndex,
                                        "quantity",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    placeholder="Qty"
                                    className={
                                      errors[`${prefix}_quantity`]
                                        ? "border-destructive"
                                        : ""
                                    }
                                  />
                                  {fieldError(`${prefix}_quantity`)}
                                </div>

                                <div className="md:col-span-2">
                                  <Input
                                    aria-label="Sub-item rate"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={sub.rate}
                                    onFocus={(e) => {
                                      if (e.target.value === "0") {
                                        e.target.value = "";
                                      }
                                    }}
                                    onChange={(e) =>
                                      handleSubItemChange(
                                        index,
                                        subIndex,
                                        "rate",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    placeholder="Rate"
                                    className={
                                      errors[`${prefix}_rate`]
                                        ? "border-destructive"
                                        : ""
                                    }
                                  />
                                  {fieldError(`${prefix}_rate`)}
                                </div>

                                <div className="md:col-span-2">
                                  <div className="h-10 flex items-center px-3 border rounded-md bg-card text-sm text-muted-foreground">
                                    ${calculateLineAmount(sub).toFixed(2)}
                                  </div>
                                </div>

                                <div className="md:col-span-1">
                                  <Button
                                    type="button"
                                    onClick={() => removeSubItem(index, subIndex)}
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Remove sub-item"
                                  >
                                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addSubItem(index)}
                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add sub-item
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="text-right">
                <div className="text-xl font-bold">
                  Total: ${calculateTotal().toFixed(2)}
                </div>
              </div>
            </div>

            <Separator />

            {/* Tax and Discount */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">
                Tax & Discount
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxRate" className="">
                    Tax Rate (%)
                  </Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.taxRate}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                    onChange={(e) =>
                      handleInputChange(
                        "taxRate",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="10"
                    className={errors.taxRate ? "border-destructive" : ""}
                  />
                  {errors.taxRate && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.taxRate}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="discountRate" className="">
                    Discount Rate (%)
                  </Label>
                  <Input
                    id="discountRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discountRate}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                    onChange={(e) =>
                      handleInputChange(
                        "discountRate",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                    className={errors.discountRate ? "border-destructive" : ""}
                  />
                  {errors.discountRate && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.discountRate}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Information */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">
                Payment Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bankName" className="">
                    Bank Name
                  </Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) =>
                      handleInputChange("bankName", e.target.value)
                    }
                    placeholder="Bank of America"
                  />
                </div>

                <div>
                  <Label htmlFor="bankAccount" className="">
                    Bank Account Number
                  </Label>
                  <Input
                    id="bankAccount"
                    value={formData.bankAccount}
                    onChange={(e) =>
                      handleInputChange("bankAccount", e.target.value)
                    }
                    placeholder="123-456-7890"
                  />
                </div>

                <div>
                  <Label htmlFor="paymentLink">Payment link</Label>
                  <Input
                    id="paymentLink"
                    type="url"
                    inputMode="url"
                    value={formData.paymentLink}
                    onChange={(e) => handleInputChange("paymentLink", e.target.value)}
                    placeholder="https://pay.stripe.com/..."
                    className={errors.paymentLink ? "border-destructive" : ""}
                  />
                  {errors.paymentLink ? (
                    <p className="text-destructive text-sm mt-1">{errors.paymentLink}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Shown on the PDF as a clickable link.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="paymentLinkText">Link text</Label>
                  <Input
                    id="paymentLinkText"
                    value={formData.paymentLinkText}
                    onChange={(e) => handleInputChange("paymentLinkText", e.target.value)}
                    placeholder="Pay this invoice online"
                    maxLength={60}
                    disabled={!formData.paymentLink?.trim()}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    The words shown on the invoice. Clicking them opens the link.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="notes" className="">
                  Notes
                </Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </div>

              <div>
                <Label htmlFor="terms" className="">
                  Terms & Conditions
                </Label>
                <textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => handleInputChange("terms", e.target.value)}
                  placeholder="Payment terms and conditions..."
                  className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-wrap justify-end gap-2 rounded-b-xl border-t bg-card/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                  Cancel
                </Button>
              )}
              <LoadingButton
                type="button"
                variant="outline"
                onClick={previewPDF}
                disabled={isSaving}
                errorMessage="Failed to generate PDF preview. Please check your data and try again."
              >
                Preview PDF
              </LoadingButton>
              <LoadingButton
                type="button"
                variant="outline"
                onClick={downloadPDF}
                disabled={isSaving}
                errorMessage="Failed to download PDF. Please check your data and try again."
              >
                Download Only
              </LoadingButton>
              {!invoice && (
                <LoadingButton
                  type="button"
                  variant="outline"
                  onClick={handleCreateAndDownload}
                  disabled={isSaving}
                  errorMessage="Failed to create and download invoice. Please check your data and try again."
                >
                  Create & Download
                </LoadingButton>
              )}
              <LoadingButton
                type="submit"
                onClick={handleSubmit}
                loading={isSaving}
                loadingText={invoice ? "Saving…" : "Creating…"}
                errorMessage={
                  invoice
                    ? "Failed to update invoice. Please check your data and try again."
                    : "Failed to create invoice. Please check your data and try again."
                }
              >
                {invoice ? "Update Invoice" : "Create Invoice"}
              </LoadingButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
