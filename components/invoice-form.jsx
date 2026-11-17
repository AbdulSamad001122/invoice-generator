"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/ui/loading-button";
import { useToast } from "@/contexts/ToastContext";
import { normalizePaymentUrl, DEFAULT_PAYMENT_LINK_TEXT } from "@/app/utils/paymentLink";
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
  CardAction,
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
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useItems } from "@/contexts/ItemContext";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
// Aliased: this file has its own local function named fetchCompanyProfile
import { fetchCompanyProfile as fetchCompanyProfileData } from "@/hooks/use-company-profile";
import { getDefaultTemplate } from "@/app/utils/templates/registry";
import { renderInvoicePdfBlob, preloadPdfRenderer } from "@/app/utils/pdfRenderer";
import { prepareInvoiceDataForPDF } from "@/app/utils/imageToBase64";
import { openPdfInNewTab } from "@/app/utils/pdfPreview";
import {
  getSubItems,
  hasSubItems,
  calculateItemAmount,
  calculateLineAmount,
  calculateItemsSubtotal,
  prepareItemsForPDF,
  lineShowsQuantity,
  anyLineShowsQuantity,
  allLinesShowQuantity,
  applyInvoiceQuantityDefault,
  getPartitions,
  createPartitionId,
  buildInvoiceSections,
  getPartitionTotals,
  looseAnchor,
  END_ANCHOR,
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
  const queryClient = useQueryClient();
  const [showSavedItemsDialog, setShowSavedItemsDialog] = useState(false);
  // Which work partition the Saved Items dialog adds to (null = ungrouped)
  const [savedItemsTarget, setSavedItemsTarget] = useState(null);
  // Work partition UI: new-partition name input (null = hidden), drag state, delete confirm
  const [newPartitionName, setNewPartitionName] = useState(null);
  const [dragArmedId, setDragArmedId] = useState(null); // drag only starts from the grip
  const [dragFromIndex, setDragFromIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [partitionToDelete, setPartitionToDelete] = useState(null);
  // Item drag and drop: itemArmed = index whose grip is pressed (drag only starts
  // from the grip), itemDrag = index being dragged, itemDropTarget = where it
  // would land: { type: "item", index } (above that item, joining its partition),
  // { type: "partition", id } (end of that partition) or { type: "ungrouped" }.
  const [itemArmed, setItemArmed] = useState(null);
  const [itemDrag, setItemDrag] = useState(null);
  const [itemDropTarget, setItemDropTarget] = useState(null);
  const endItemDrag = () => {
    setItemDrag(null);
    setItemDropTarget(null);
    setItemArmed(null);
  };

  // While a partition is being dragged, scroll the page when the pointer is near
  // the top or bottom edge, faster the closer it gets, so long invoices can be
  // reordered without dropping and re-grabbing.
  useEffect(() => {
    if (dragFromIndex === null && itemDrag === null) return undefined;
    const EDGE = 100; // px from the window edge where scrolling starts
    const MAX_SPEED = 22; // px per frame at the very edge
    let pointerY = null;
    let frame = null;
    const onDragOver = (e) => {
      pointerY = e.clientY;
    };
    const tick = () => {
      if (pointerY !== null) {
        const fromTop = pointerY;
        const fromBottom = window.innerHeight - pointerY;
        let dy = 0;
        if (fromTop < EDGE) dy = -MAX_SPEED * (1 - Math.max(fromTop, 0) / EDGE);
        else if (fromBottom < EDGE) dy = MAX_SPEED * (1 - Math.max(fromBottom, 0) / EDGE);
        if (dy !== 0) window.scrollBy(0, Math.round(dy));
      }
      frame = requestAnimationFrame(tick);
    };
    document.addEventListener("dragover", onDragOver);
    frame = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      cancelAnimationFrame(frame);
    };
  }, [dragFromIndex, itemDrag]);
  const openSavedItems = (partitionId = null) => {
    setSavedItemsTarget(partitionId);
    setShowSavedItemsDialog(true);
  };
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
      items: applyInvoiceQuantityDefault(invoiceData?.items, invoiceData?.includeQuantity) || [
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
      // Work partitions ([{ id, name }] in display order); none by default
      partitions: getPartitions(invoiceData?.partitions),
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
        items: applyInvoiceQuantityDefault(invoiceData?.items, invoiceData?.includeQuantity) || [
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
        partitions: getPartitions(invoiceData?.partitions),
      });
    }
  }, [invoice]);

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Download the PDF code in the background so Preview/Download are instant
  useEffect(() => {
    preloadPdfRenderer();
  }, []);

  const [isLoadingAutoData, setIsLoadingAutoData] = useState(false);
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
          setFormData((prev) => ({ ...prev, invoiceNumber: nextInvoiceNumber }));
        } catch (error) {
          console.error("Error generating invoice number:", error);
          // Fallback to INV-1 if there's an error
          setFormData((prev) => ({ ...prev, invoiceNumber: "INV-1" }));
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

  // Client details come from the client record (no fields on this form).
  // New invoices use it directly; editing keeps the invoice's saved details and only fills gaps.
  useEffect(() => {
    if (!preselectedClient) return;
    setFormData((prev) => ({
      ...prev,
      clientName: invoice
        ? prev.clientName || preselectedClient.name || ""
        : preselectedClient.name || "",
      clientEmail: invoice
        ? prev.clientEmail || preselectedClient.email || ""
        : preselectedClient.email || "",
    }));
  }, [invoice, preselectedClient]);

  // Company details always come from the company profile (no fields on this form).
  // Editing keeps the invoice's saved company details and only fills in missing ones,
  // since profile edits already offer to update past invoices.
  // "loading" | "ready" | "error". Saving waits for it; a failed load can be retried.
  const [profileStatus, setProfileStatus] = useState("loading");
  const [profileAttempt, setProfileAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchCompanyProfile = async () => {
      setProfileStatus("loading");
      try {
        // Cached: instant when the profile was already loaded elsewhere
        const profileData = await queryClient.fetchQuery({
          queryKey: queryKeys.companyProfile,
          queryFn: fetchCompanyProfileData,
          staleTime: 5 * 60 * 1000,
        });
        if (cancelled) return;
        const result = { success: true, data: profileData };
        {
          if (result.success && result.data && invoice) {
            setFormData((prev) => ({
              ...prev,
              companyName: prev.companyName || result.data.companyName || "",
              companyEmail: prev.companyEmail || result.data.companyEmail || "",
              companyLogo: prev.companyLogo || result.data.companyLogo || "",
            }));
          } else if (result.success && result.data) {
            const companyDefaultDueDays = result.data.defaultDueDays || 30;
            setDefaultDueDays(companyDefaultDueDays);
            
            const issueDate = new Date();
            const calculatedDueDate = new Date(issueDate);
            calculatedDueDate.setDate(calculatedDueDate.getDate() + companyDefaultDueDays);
            
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
        if (!cancelled) setProfileStatus("ready");
      } catch (error) {
        console.error('Error fetching company profile:', error);
        if (!cancelled) setProfileStatus("error");
      }
    };

    fetchCompanyProfile();
    return () => {
      cancelled = true;
    };
    // Re-run when the invoice changes or the user retries a failed load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, profileAttempt]);

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
        if (lineShowsQuantity(line) && (!line.quantity || line.quantity <= 0)) {
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
    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return false;
    }

    // Company and client details come from the company profile and the client record,
    // so they can't be fixed on this form: say what's wrong and where to fix it.
    const missingCompany = !formData.companyName.trim() || !formData.companyEmail.trim();
    if (missingCompany && profileStatus === "loading") {
      toast.info("Still loading your company details. Try again in a moment.");
      return false;
    }
    if (missingCompany && profileStatus === "error") {
      toast.error("Couldn't load your company profile. Retrying, try again in a moment.");
      setProfileAttempt((n) => n + 1);
      return false;
    }
    if (missingCompany) {
      toast.error("Add your company name and email in Company profile first.");
      return false;
    }
    if (!formData.clientName.trim()) {
      toast.error("This client has no name. Edit the client and try again.");
      return false;
    }
    return true;
  };

  // Saves the invoice. Returns the API response data, or null if nothing was saved.
  const saveInvoice = async () => {
    const invoicePayload = {
      ...formData,
      includeQuantity: anyLineShowsQuantity(formData.items),
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

  // Hiding a line's quantity folds quantity × rate into its price, so the line
  // amount (and the invoice total) stays exactly the same.
  const round2 = (n) => Math.round(n * 100) / 100;
  const setLineQuantityVisibility = (line, visible) => {
    if (visible) return { ...line, showQuantity: true };
    const qty = Number(line.quantity) || 1;
    return {
      ...line,
      showQuantity: false,
      quantity: 1,
      ...(qty !== 1 ? { rate: round2(qty * (Number(line.rate) || 0)) } : {}),
    };
  };
  const clearQuantityErrors = (prefix) =>
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next)
        .filter((k) => k.endsWith("_quantity") && (!prefix || k.startsWith(prefix)))
        .forEach((k) => delete next[k]);
      return next;
    });

  // "Show quantity on all items": turn every line on or off at once
  const handleQuantityToggle = (checked) => {
    const folded = !checked && formData.items.some(
      (item) =>
        (Number(item.quantity) || 1) !== 1 ||
        (item.subItems || []).some((sub) => (Number(sub.quantity) || 1) !== 1)
    );
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...setLineQuantityVisibility(item, checked),
        ...(Array.isArray(item.subItems)
          ? { subItems: item.subItems.map((sub) => setLineQuantityVisibility(sub, checked)) }
          : {}),
      })),
    }));
    if (!checked) clearQuantityErrors();
    if (folded) {
      toast.info("Quantities were folded into the prices, so the totals stay the same.");
    }
  };

  // Show or hide the quantity of one item, or of one sub-item (subIndex given)
  const setQuantityVisible = (index, subIndex, visible) => {
    setFormData((prev) => {
      const items = [...prev.items];
      const item = items[index];
      if (subIndex === null || subIndex === undefined) {
        items[index] = setLineQuantityVisibility(item, visible);
      } else {
        const subItems = [...(item.subItems || [])];
        subItems[subIndex] = setLineQuantityVisibility(subItems[subIndex], visible);
        items[index] = { ...item, subItems };
      }
      return { ...prev, items };
    });
    if (!visible) {
      clearQuantityErrors(subIndex === null || subIndex === undefined ? `item_${index}_` : `item_${index}_sub_${subIndex}_`);
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
                showQuantity: lineShowsQuantity(item),
              }
            : { itemName: "", description: "", quantity: 1, rate: 0, showQuantity: lineShowsQuantity(existing[existing.length - 1] || item) },
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

  // partitionId: add the item inside that work partition (omit for ungrouped)
  const addItem = (partitionId) => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemName: "",
          description: "",
          quantity: 1,
          rate: 0,
          showQuantity: prev.items.length === 0 || anyLineShowsQuantity(prev.items),
          ...(partitionId ? { partitionId } : {}),
        },
      ],
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, items: newItems }));
      // Indexes shift, so drop item errors (they're re-checked on save)
      setErrors((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith("item_")))
      );
    }
  };

  const addSavedItem = (savedItem, partitionId = savedItemsTarget) => {
    const newItem = {
      itemName: savedItem.name,
      description: savedItem.description || "",
      quantity: 1,
      rate: Number(savedItem.price),
      ...(partitionId ? { partitionId } : {}),
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

  // ---------- Work partitions
  const isBlankItem = (item) =>
    !(item.itemName || "").trim() && !(Number(item.rate) > 0) && !hasSubItems(item);

  const addPartition = (name) => {
    const partition = { id: createPartitionId(), name: name.trim() };
    setFormData((prev) => {
      const known = new Set(prev.partitions.map((p) => p.id));
      const isUngrouped = (item) => !item.partitionId || !known.has(item.partitionId);
      const ungrouped = prev.items.filter(isUngrouped);
      // A fresh invoice's empty starter line moves into the first partition
      // instead of being left behind as a blank ungrouped item.
      const moveBlanks = ungrouped.length > 0 && ungrouped.every(isBlankItem);
      let items = moveBlanks
        ? prev.items.map((item) => (isUngrouped(item) ? { ...item, partitionId: partition.id } : item))
        : prev.items;
      if (!items.some((item) => item.partitionId === partition.id)) {
        items = [
          ...items,
          {
            itemName: "",
            description: "",
            quantity: 1,
            rate: 0,
            showQuantity: anyLineShowsQuantity(prev.items),
            partitionId: partition.id,
          },
        ];
      }
      return { ...prev, partitions: [...prev.partitions, partition], items };
    });
    return partition.id;
  };

  const renamePartition = (partitionId, name) =>
    setFormData((prev) => ({
      ...prev,
      partitions: prev.partitions.map((p) => (p.id === partitionId ? { ...p, name } : p)),
    }));

  // Removes the partition and its items. Keeps at least one (blank) item on the invoice.
  const removePartition = (partitionId) => {
    setFormData((prev) => {
      const pIndex = prev.partitions.findIndex((p) => p.id === partitionId);
      const nextAnchor = prev.partitions[pIndex + 1]?.id || END_ANCHOR;
      let items = prev.items
        .filter((item) => item.partitionId !== partitionId)
        // Loose items that sat above the deleted partition keep their place
        .map((item) => (item.placeBefore === partitionId ? { ...item, placeBefore: nextAnchor } : item));
      if (items.length === 0) {
        items = [{ itemName: "", description: "", quantity: 1, rate: 0, showQuantity: true }];
      }
      return { ...prev, partitions: prev.partitions.filter((p) => p.id !== partitionId), items };
    });
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith("item_")))
    );
  };

  // Moves the item at flat index `from` to a drop target (see itemDropTarget):
  //   { type: "item", index }        just before that item, in the same place
  //                                  (same partition, or same loose spot)
  //   { type: "partition", id }      end of that partition (partition items only)
  //   { type: "beforePartition", id } loose item: directly above that partition
  //   { type: "afterPartition", id }  loose item: directly below that partition
  // Order inside a section follows the flat items order.
  const moveItem = (from, target) => {
    setFormData((prev) => {
      const known = new Set(prev.partitions.map((p) => p.id));
      const partitionOf = (it) => (it.partitionId && known.has(it.partitionId) ? it.partitionId : null);
      const firstId = prev.partitions[0]?.id;
      // Normalised loose spot: a partition id it sits above, or END_ANCHOR
      const spotOf = (it) => looseAnchor(it, known) || firstId;
      const asPartitionItem = (it, pid) => {
        const { placeBefore: _p, ...rest } = it;
        return { ...rest, partitionId: pid };
      };
      const asLooseItem = (it, spot) => {
        const { partitionId: _id, placeBefore: _p, ...rest } = it;
        return spot && spot !== firstId ? { ...rest, placeBefore: spot } : rest;
      };
      if (target.type === "item" && target.index === from) return prev;

      const items = [...prev.items];
      const [moving] = items.splice(from, 1);
      // Insert right after the last item matching `match` (else at the end)
      const insertAfterLast = (match, value) => {
        let at = items.length;
        for (let i = items.length - 1; i >= 0; i--) {
          if (match(items[i])) {
            at = i + 1;
            break;
          }
        }
        items.splice(at, 0, value);
      };

      if (target.type === "item") {
        const anchor = prev.items[target.index];
        const to = target.index > from ? target.index - 1 : target.index;
        const pid = partitionOf(anchor);
        items.splice(to, 0, pid ? asPartitionItem(moving, pid) : asLooseItem(moving, spotOf(anchor)));
      } else if (target.type === "partition") {
        insertAfterLast((it) => partitionOf(it) === target.id, asPartitionItem(moving, target.id));
      } else {
        let spot = target.id;
        if (target.type === "afterPartition") {
          const i = prev.partitions.findIndex((p) => p.id === target.id);
          spot = prev.partitions[i + 1]?.id || END_ANCHOR;
        }
        insertAfterLast(
          (it) => !partitionOf(it) && spotOf(it) === spot,
          asLooseItem(moving, spot)
        );
      }
      return { ...prev, items };
    });
    // Indexes changed: drop item errors (re-checked on save)
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith("item_")))
    );
  };

  // Moves the partition at index `from` to index `to` (display order)
  const movePartition = (from, to) => {
    setFormData((prev) => {
      if (to < 0 || to >= prev.partitions.length || from === to) return prev;
      const partitions = [...prev.partitions];
      const [moved] = partitions.splice(from, 1);
      partitions.splice(to, 0, moved);
      return { ...prev, partitions };
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
      partitions: formData.partitions,
      includeDescription: formData.includeDescription,
      includeQuantity: anyLineShowsQuantity(formData.items),
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
      // Opens the tab inside the click, then fills it once the PDF is ready
      const result = await openPdfInNewTab(async () => {
        const preparedInvoiceData = await prepareInvoiceDataForPDF(generateInvoiceData());
        return renderInvoicePdfBlob(formData.selectedTemplate, preparedInvoiceData);
      });
      if (result === "blocked") {
        toast.error("Your browser blocked the new tab. Allow pop-ups for this site and try again.");
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

  // Loose items (not in a partition) only move between partitions; partition
  // items only move among partition items. Never across the two.
  const knownPartitionIds = new Set(formData.partitions.map((p) => p.id));
  const isLooseItem = (it) => !(it?.partitionId && knownPartitionIds.has(it.partitionId));
  const dragIsLoose = itemDrag !== null && isLooseItem(formData.items[itemDrag]);

  // One item row (with its sub-items). index = position in formData.items.
  const renderItem = (item, index) => {
                  const subItems = getSubItems(item);
                  const isGroup = subItems.length > 0;
                  const showQuantity = lineShowsQuantity(item);
                  const nameSpan = formData.includeDescription
                    ? "md:col-span-3"
                    : "md:col-span-5";
                  const fieldError = (key) =>
                    errors[key] ? (
                      <p className="text-destructive text-sm mt-1">
                        {errors[key]}
                      </p>
                    ) : null;

                  const isItemDragging = itemDrag === index;
                  const isItemDropTarget =
                    itemDrag !== null &&
                    itemDrag !== index &&
                    itemDropTarget?.type === "item" &&
                    itemDropTarget.index === index;
                  return (
                    <div
                      key={index}
                      draggable={itemArmed === index}
                      onDragStart={(e) => {
                        if (itemArmed !== index) return;
                        e.stopPropagation(); // not a partition drag
                        setItemDrag(index);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", `item-${index}`);
                      }}
                      onDragOver={(e) => {
                        // Loose items only land among loose items, partition items
                        // among partition items; otherwise let the partition box handle it
                        if (itemDrag === null || dragIsLoose !== isLooseItem(item)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        if (!(itemDropTarget?.type === "item" && itemDropTarget.index === index)) {
                          setItemDropTarget({ type: "item", index });
                        }
                      }}
                      onDrop={(e) => {
                        if (itemDrag === null || dragIsLoose !== isLooseItem(item)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        moveItem(itemDrag, { type: "item", index });
                        endItemDrag();
                      }}
                      onDragEnd={(e) => {
                        e.stopPropagation();
                        endItemDrag();
                      }}
                      className={`relative ${
                        isGroup
                          ? "rounded-lg border bg-muted/40 p-3 pl-10 space-y-3"
                          : "space-y-2 pl-8"
                      } ${isItemDragging ? "opacity-50" : ""} ${
                        // Line above this item = "drop lands here"
                        isItemDropTarget
                          ? "before:absolute before:-top-2 before:left-0 before:right-0 before:h-0.5 before:rounded before:bg-primary"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`absolute top-[30px] cursor-grab rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing ${
                          isGroup ? "left-2.5 top-[42px]" : "left-0"
                        }`}
                        title="Drag to move (above another item, or into a partition)"
                        aria-label={`Move ${item.itemName || "item"} (drag)`}
                        onPointerDown={() => setItemArmed(index)}
                        onPointerUp={() => setItemArmed(null)}
                      >
                        <GripVertical className="size-4" />
                      </button>
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
                          <div className={`md:col-span-4 h-10 flex items-center text-sm text-muted-foreground`}>
                            Total of {subItems.length} sub-item
                            {subItems.length === 1 ? "" : "s"}
                          </div>
                        ) : (
                          <>
                            <div className="md:col-span-2">
                              <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                              {showQuantity ? (
                              <div className="relative">
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
                                className={`pr-8 ${
                                  errors[`item_${index}_quantity`]
                                    ? "border-destructive"
                                    : ""
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setQuantityVisible(index, null, false)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                title="Hide quantity on this line"
                                aria-label="Hide quantity on this line"
                              >
                                <X className="size-3.5" />
                              </button>
                              </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setQuantityVisible(index, null, true)}
                                  className="h-9 w-full border-dashed text-muted-foreground"
                                  title="Show a quantity on this line"
                                >
                                  <Plus /> Qty
                                </Button>
                              )}
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

                                <div className="md:col-span-2">
                                  {lineShowsQuantity(sub) ? (
                                  <div className="relative">
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
                                    className={`pr-8 ${
                                      errors[`${prefix}_quantity`]
                                        ? "border-destructive"
                                        : ""
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setQuantityVisible(index, subIndex, false)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    title="Hide quantity on this sub-item"
                                    aria-label="Hide quantity on this sub-item"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                  </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setQuantityVisible(index, subIndex, true)}
                                      className="h-9 w-full border-dashed text-muted-foreground"
                                      title="Show a quantity on this sub-item"
                                    >
                                      <Plus /> Qty
                                    </Button>
                                  )}
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
          <CardAction>
            <TemplateSelector
              compact
              selectedTemplate={formData.selectedTemplate}
              onTemplateChange={(templateId) =>
                handleInputChange("selectedTemplate", templateId)
              }
            />
          </CardAction>
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

            {/* Older invoices may carry extra company/client details that can no longer be
                added here. Show them so nothing prints that the user can't see or remove. */}
            {[
              { type: "company", label: "Company", fields: formData.companyCustomFields },
              { type: "client", label: "Client", fields: formData.clientCustomFields },
            ].some((g) => g.fields?.length > 0) && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="text-sm font-medium">Extra details on this invoice</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saved with this invoice and printed on its PDF. Remove any you no longer want.
                </p>
                <ul className="mt-2 space-y-1">
                  {[
                    { type: "company", label: "Company", fields: formData.companyCustomFields },
                    { type: "client", label: "Client", fields: formData.clientCustomFields },
                  ].flatMap(({ type, label, fields }) =>
                    (fields || []).map((field, index) => (
                      <li
                        key={`${type}-${index}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          <span className="text-muted-foreground">{label} · </span>
                          {field.name ? `${field.name}: ` : ""}
                          {field.value}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`Remove ${label.toLowerCase()} detail ${field.name || field.value}`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              [`${type}CustomFields`]: prev[`${type}CustomFields`].filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
                        >
                          <X />
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            <Separator />

            {/* Items */}
            <div className="space-y-4">
              {/* Work partitions: centred above the items */}
              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={() => setNewPartitionName((name) => (name === null ? "" : name))}
                  variant="outline"
                  size="sm"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Add work partition
                </Button>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">Items</h3>
                <div className="flex gap-2">
                  {availableItems.length > 0 && (
                    <Dialog
                      open={showSavedItemsDialog}
                      onOpenChange={setShowSavedItemsDialog}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openSavedItems(null)}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Saved Items
                      </Button>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Select Saved Items</DialogTitle>
                          <DialogDescription>
                            {savedItemsTarget
                              ? `Add a saved item to "${
                                  formData.partitions.find((p) => p.id === savedItemsTarget)?.name ||
                                  "this partition"
                                }".`
                              : "Choose from your saved items to add to this invoice."}
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
                    onClick={() => addItem()}
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
                  checked={allLinesShowQuantity(formData.items)}
                  onCheckedChange={handleQuantityToggle}
                />
                <Label htmlFor="includeQuantity" className="text-sm font-medium">
                  Show quantity on all items
                </Label>
              </div>
              </div>

              {errors.items && (
                <p className="text-destructive text-sm">{errors.items}</p>
              )}

              <div className="space-y-3">
                {/* New work partition: name it, then it appears below */}
                {newPartitionName !== null && (
                  <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center">
                    <Layers className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                    <Input
                      autoFocus
                      value={newPartitionName}
                      onChange={(e) => setNewPartitionName(e.target.value)}
                      onKeyDown={(e) => {
                        // Inside the invoice <form>: Enter must not submit the invoice
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newPartitionName.trim()) {
                            addPartition(newPartitionName);
                            setNewPartitionName(null);
                          }
                        } else if (e.key === "Escape") {
                          setNewPartitionName(null);
                        }
                      }}
                      placeholder="Partition name, e.g. Quiz, Post design, Raja"
                      aria-label="New work partition name"
                      maxLength={80}
                      className="sm:max-w-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!newPartitionName.trim()}
                        onClick={() => {
                          addPartition(newPartitionName);
                          setNewPartitionName(null);
                        }}
                      >
                        Create partition
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setNewPartitionName(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {buildInvoiceSections(formData.items, formData.partitions).map((section) => {
                  // Loose items: at the top, between partitions, or after the last one
                  if (!section.partition) {
                    // Dropping in the gaps of this group puts the item at the end of it
                    const spotTarget =
                      section.anchor === END_ANCHOR || !section.anchor
                        ? { type: "afterPartition", id: formData.partitions[formData.partitions.length - 1]?.id }
                        : { type: "beforePartition", id: section.anchor };
                    return (
                      <div
                        key={`loose-${section.anchor || "top"}`}
                        className="space-y-3 rounded-lg"
                        onDragOver={(e) => {
                          if (itemDrag === null || !dragIsLoose) return;
                          e.preventDefault();
                          if (
                            !(itemDropTarget?.type === spotTarget.type && itemDropTarget.id === spotTarget.id)
                          ) {
                            setItemDropTarget(spotTarget);
                          }
                        }}
                        onDrop={(e) => {
                          if (itemDrag === null || !dragIsLoose) return;
                          e.preventDefault();
                          moveItem(itemDrag, spotTarget.id ? spotTarget : { type: "afterPartition", id: null });
                          endItemDrag();
                        }}
                      >
                        {section.items.map(({ item, index }) => renderItem(item, index))}
                      </div>
                    );
                  }

                  const partition = section.partition;
                  const pIndex = formData.partitions.findIndex((p) => p.id === partition.id);
                  const isDragging = dragFromIndex === pIndex;
                  const isDropTarget =
                    (dragOverIndex === pIndex && dragFromIndex !== null && !isDragging) ||
                    (itemDrag !== null && itemDropTarget?.type === "partition" && itemDropTarget.id === partition.id);
                  // A loose item hovering this box lands above it (top half) or below it (bottom half)
                  const looseAbove =
                    itemDrag !== null && itemDropTarget?.type === "beforePartition" && itemDropTarget.id === partition.id;
                  const looseBelow =
                    itemDrag !== null && itemDropTarget?.type === "afterPartition" && itemDropTarget.id === partition.id;
                  const count = section.items.length;
                  const label = partition.name || "partition";
                  const endDrag = () => {
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                    setDragArmedId(null);
                  };
                  return (
                    <section
                      key={partition.id}
                      aria-label={`Work partition ${partition.name || "untitled"}`}
                      draggable={dragArmedId === partition.id}
                      onDragStart={(e) => {
                        setDragFromIndex(pIndex);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", partition.id);
                      }}
                      onDragOver={(e) => {
                        if (itemDrag !== null) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          let next;
                          if (dragIsLoose) {
                            // Loose items never go inside a partition: above or below the box
                            const box = e.currentTarget.getBoundingClientRect();
                            const above = e.clientY < box.top + box.height / 2;
                            next = { type: above ? "beforePartition" : "afterPartition", id: partition.id };
                          } else {
                            // Partition item on the header / empty area: add at the end of this partition
                            next = { type: "partition", id: partition.id };
                          }
                          if (!(itemDropTarget?.type === next.type && itemDropTarget.id === next.id)) {
                            setItemDropTarget(next);
                          }
                          return;
                        }
                        if (dragFromIndex === null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverIndex !== pIndex) setDragOverIndex(pIndex);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (itemDrag !== null) {
                          if (itemDropTarget && itemDropTarget.id === partition.id) {
                            moveItem(itemDrag, itemDropTarget);
                          }
                          endItemDrag();
                          return;
                        }
                        if (dragFromIndex !== null) movePartition(dragFromIndex, pIndex);
                        endDrag();
                      }}
                      onDragEnd={endDrag}
                      className={`overflow-hidden rounded-xl border-2 bg-card transition-[opacity,box-shadow,border-color] ${
                        isDragging ? "opacity-50" : ""
                      } ${isDropTarget ? "border-primary ring-2 ring-primary/30" : "border-primary/20"} ${
                        looseAbove ? "shadow-[0_-6px_0_-2px_var(--primary)]" : ""
                      } ${looseBelow ? "shadow-[0_6px_0_-2px_var(--primary)]" : ""}`}
                    >
                      {/* Partition header */}
                      <div className="flex flex-wrap items-center gap-2 border-b border-primary/15 bg-primary/5 px-2 py-2 sm:flex-nowrap sm:px-3">
                        <button
                          type="button"
                          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
                          title="Drag to reorder"
                          aria-label={`Reorder ${label} (drag, or use the arrow buttons)`}
                          onPointerDown={() => setDragArmedId(partition.id)}
                          onPointerUp={() => setDragArmedId(null)}
                        >
                          <GripVertical className="size-4" />
                        </button>
                        <span className="hidden shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
                          Work partition
                        </span>
                        <Input
                          value={partition.name}
                          onChange={(e) => renamePartition(partition.id, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                          placeholder="Partition name"
                          aria-label="Partition name"
                          maxLength={80}
                          className="h-8 min-w-0 flex-1 border-transparent bg-transparent font-semibold shadow-none hover:border-input focus-visible:border-input sm:max-w-sm dark:bg-transparent"
                        />
                        <span className="ml-auto shrink-0 text-sm text-muted-foreground tabular-nums">
                          {count} item{count === 1 ? "" : "s"} ·{" "}
                          <span className="font-semibold text-foreground">${section.total.toFixed(2)}</span>
                        </span>
                        <div className="flex shrink-0 items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={pIndex === 0}
                            onClick={() => movePartition(pIndex, pIndex - 1)}
                            aria-label={`Move ${label} up`}
                            title="Move up"
                          >
                            <ChevronUp />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={pIndex === formData.partitions.length - 1}
                            onClick={() => movePartition(pIndex, pIndex + 1)}
                            aria-label={`Move ${label} down`}
                            title="Move down"
                          >
                            <ChevronDown />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setPartitionToDelete(partition)}
                            aria-label={`Delete ${label}`}
                            title="Delete partition"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>

                      {/* Partition items */}
                      <div className="space-y-3 p-3">
                        {count === 0 && (
                          <p className="text-sm text-muted-foreground">No items in this partition yet.</p>
                        )}
                        {section.items.map(({ item, index }) => renderItem(item, index))}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => addItem(partition.id)}>
                            <Plus className="w-4 h-4 mr-1" /> Add item
                          </Button>
                          {availableItems.length > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openSavedItems(partition.id)}
                            >
                              <Package className="w-4 h-4 mr-1" /> Saved items
                            </Button>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="ml-auto max-w-sm space-y-1 text-right">
                {formData.partitions.length > 0 &&
                  getPartitionTotals(formData.items, formData.partitions).map((p) => (
                    <div key={p.id} className="flex justify-between gap-6 text-sm text-muted-foreground">
                      <span className="truncate">{p.name || "Untitled partition"}</span>
                      <span className="tabular-nums">${p.total.toFixed(2)}</span>
                    </div>
                  ))}
                <div className="text-xl font-bold">
                  Total: ${calculateTotal().toFixed(2)}
                </div>
              </div>

              {/* Delete partition */}
              <Dialog open={Boolean(partitionToDelete)} onOpenChange={(open) => !open && setPartitionToDelete(null)}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Delete &ldquo;{partitionToDelete?.name || "this partition"}&rdquo;?</DialogTitle>
                    <DialogDescription>
                      This removes the partition and its{" "}
                      {formData.items.filter((i) => i.partitionId === partitionToDelete?.id).length} item(s) from
                      this invoice.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setPartitionToDelete(null)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        removePartition(partitionToDelete.id);
                        setPartitionToDelete(null);
                      }}
                    >
                      Delete partition
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
                    placeholder={DEFAULT_PAYMENT_LINK_TEXT}
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
