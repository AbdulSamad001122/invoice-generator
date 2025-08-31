"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import InvoicePDF from "@/app/utils/invoiceTemplate";
import axios from "axios";

export default function InvoiceForm({
  invoice,
  onInvoiceCreated,
  onCancel,
  preselectedClient,
}) {
  const [formData, setFormData] = useState(() => {
    // If editing an invoice, extract data from the data field
    const invoiceData = invoice?.data || {};

    return {
      invoiceNumber: invoiceData?.invoiceNumber || "",
      issueDate:
        invoiceData?.issueDate || new Date().toISOString().split("T")[0],
      dueDate: invoiceData?.dueDate || "",
      // Company Information
      companyName: invoiceData?.companyName || "",
      companyEmail: invoiceData?.companyEmail || "",

      companyLogo: invoiceData?.companyLogo || "",
      // Client Information
      clientName: invoiceData?.clientName || "",
      clientEmail: invoiceData?.clientEmail || "",
      clientPhone: invoiceData?.clientPhone || "",

      // Items and Calculations
      items: invoiceData?.items || [{ description: "", quantity: 1, rate: 0 }],
      taxRate: invoiceData?.taxRate || 0,
      discountRate: invoiceData?.discountRate || 0,
      // Additional Information
      notes: invoiceData?.notes || "",
      terms: invoiceData?.terms || "",
      // Payment Information
      bankName: invoiceData?.bankName || "",
      bankAccount: invoiceData?.bankAccount || "",

    };
  });

  const [errors, setErrors] = useState({});

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

    if (!formData.clientEmail.trim()) {
      newErrors.clientEmail = "Client email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.clientEmail)) {
      newErrors.clientEmail = "Please enter a valid email address";
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
      formData.items.forEach((item, index) => {
        if (!item.description.trim()) {
          newErrors[`item_${index}_description`] = "Description is required";
        }
        if (!item.quantity || item.quantity <= 0) {
          newErrors[`item_${index}_quantity`] =
            "Quantity must be greater than 0";
        }
        if (!item.rate || item.rate <= 0) {
          newErrors[`item_${index}_rate`] = "Rate must be greater than 0";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        console.log(formData);
        // Send invoice data to API route with client ID
        const invoicePayload = {
          ...formData,
          clientId: preselectedClient?.id || null,
        };

        let response;
        if (invoice && invoice.id) {
          // Update existing invoice
          response = await axios.put(
            `/api/invoices?id=${invoice.id}`,
            invoicePayload
          );
          console.log("Invoice updated successfully:", response.data);
        } else {
          // Create new invoice
          response = await axios.post("/api/createInvoice", invoicePayload);
          console.log("Invoice created successfully:", response.data);
        }

        onInvoiceCreated(response.data);
      } catch (error) {
        console.error("Error saving invoice:", error);
        // Still call onInvoiceCreated to maintain current functionality
        onInvoiceCreated(formData);
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, rate: 0 }],
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, items: newItems }));
    }
  };

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      return total + item.quantity * item.rate;
    }, 0);
  };

  const downloadPDF = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const invoiceData = {
        companyName: formData.companyName,
        companyEmail: formData.companyEmail,
        companyLogo: formData.companyLogo,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.issueDate,
        dueDate: formData.dueDate,
        items: formData.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate,
        })),
        taxRate: formData.taxRate,
        discountRate: formData.discountRate,
        notes: formData.notes || "Thank you for your business!",
        terms: formData.terms,
        bankName: formData.bankName,
        bankAccount: formData.bankAccount,
      };

      const blob = await pdf(<InvoicePDF invoiceData={invoiceData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${formData.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  const createAndDownloadPDF = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // First create the invoice in the database
      const invoicePayload = {
        ...formData,
        clientId: preselectedClient?.id || null,
      };

      let response;
      if (invoice && invoice.id) {
        // Update existing invoice
        response = await axios.put(
          `/api/invoices?id=${invoice.id}`,
          invoicePayload
        );
        console.log("Invoice updated successfully:", response.data);
      } else {
        // Create new invoice
        response = await axios.post("/api/createInvoice", invoicePayload);
        console.log("Invoice created successfully:", response.data);
      }

      // Then download the PDF
      const invoiceData = {
        companyName: formData.companyName,
        companyEmail: formData.companyEmail,
        companyLogo: formData.companyLogo,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.issueDate,
        dueDate: formData.dueDate,
        items: formData.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate,
        })),
        taxRate: formData.taxRate,
        discountRate: formData.discountRate,
        notes: formData.notes || "Thank you for your business!",
        terms: formData.terms,
        bankName: formData.bankName,
        bankAccount: formData.bankAccount,
      };

      const blob = await pdf(<InvoicePDF invoiceData={invoiceData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${formData.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Call the callback to update the parent component
      onInvoiceCreated(response.data);
    } catch (error) {
      console.error("Error creating invoice and downloading PDF:", error);
      alert("Error creating invoice and downloading PDF. Please try again.");
    }
  };

  const previewPDF = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const invoiceData = {
        companyName: formData.companyName,
        companyEmail: formData.companyEmail,
        companyLogo: formData.companyLogo,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.issueDate,
        dueDate: formData.dueDate,
        items: formData.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate,
        })),
        taxRate: formData.taxRate,
        discountRate: formData.discountRate,
        notes: formData.notes || "Thank you for your business!",
        terms: formData.terms,
        bankName: formData.bankName,
        bankAccount: formData.bankAccount,
      };

      const blob = await pdf(<InvoicePDF invoiceData={invoiceData} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      alert("Error generating PDF preview. Please try again.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {invoice ? "Edit Invoice" : "Create New Invoice"}
          </CardTitle>
          <CardDescription>
            Fill in the details below to {invoice ? "update" : "create"} your
            invoice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) =>
                    handleInputChange("invoiceNumber", e.target.value)
                  }
                  placeholder="INV-001"
                  className={errors.invoiceNumber ? "border-red-500" : ""}
                />
                {errors.invoiceNumber && (
                  <p className="text-red-500 text-sm mt-1">
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
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange("dueDate", e.target.value)}
                  className={errors.dueDate ? "border-red-500" : ""}
                />
                {errors.dueDate && (
                  <p className="text-red-500 text-sm mt-1">{errors.dueDate}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Company Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Company Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) =>
                      handleInputChange("companyName", e.target.value)
                    }
                    placeholder="Your Company Name"
                    className={errors.companyName ? "border-red-500" : ""}
                  />
                  {errors.companyName && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.companyName}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="companyEmail">Company Email *</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) =>
                      handleInputChange("companyEmail", e.target.value)
                    }
                    placeholder="company@example.com"
                    className={errors.companyEmail ? "border-red-500" : ""}
                  />
                  {errors.companyEmail && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.companyEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyLogo">Company Logo</Label>
                  <Input
                    id="companyLogo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          handleInputChange("companyLogo", event.target.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {formData.companyLogo && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={formData.companyLogo}
                          alt="Company Logo Preview"
                          className="w-16 h-16 object-contain border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => handleInputChange("companyLogo", "")}
                          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Client Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Client Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) =>
                      handleInputChange("clientName", e.target.value)
                    }
                    placeholder="John Doe"
                    className={errors.clientName ? "border-red-500" : ""}
                  />
                  {errors.clientName && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.clientName}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="clientEmail">Client Email *</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) =>
                      handleInputChange("clientEmail", e.target.value)
                    }
                    placeholder="john@example.com"
                    className={errors.clientEmail ? "border-red-500" : ""}
                  />
                  {errors.clientEmail && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.clientEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientPhone">Client Phone</Label>
                  <Input
                    id="clientPhone"
                    value={formData.clientPhone}
                    onChange={(e) =>
                      handleInputChange("clientPhone", e.target.value)
                    }
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <Label htmlFor="clientCity">Client City</Label>
                  <Input
                    id="clientCity"
                    value={formData.clientCity}
                    onChange={(e) =>
                      handleInputChange("clientCity", e.target.value)
                    }
                    placeholder="New York"
                  />
                </div>
              </div>


            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Items</h3>
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

              {errors.items && (
                <p className="text-red-500 text-sm">{errors.items}</p>
              )}

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <div className="md:col-span-5">
                      <Label htmlFor={`description-${index}`}>
                        Description
                      </Label>
                      <Input
                        id={`description-${index}`}
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        placeholder="Item description"
                        className={
                          errors[`item_${index}_description`]
                            ? "border-red-500"
                            : ""
                        }
                      />
                      {errors[`item_${index}_description`] && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[`item_${index}_description`]}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "quantity",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className={
                          errors[`item_${index}_quantity`]
                            ? "border-red-500"
                            : ""
                        }
                      />
                      {errors[`item_${index}_quantity`] && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[`item_${index}_quantity`]}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor={`rate-${index}`}>Rate ($)</Label>
                      <Input
                        id={`rate-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "rate",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={
                          errors[`item_${index}_rate`] ? "border-red-500" : ""
                        }
                      />
                      {errors[`item_${index}_rate`] && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[`item_${index}_rate`]}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label>Amount</Label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-gray-50">
                        ${(item.quantity * item.rate).toFixed(2)}
                      </div>
                    </div>

                    <div className="md:col-span-1">
                      <Button
                        type="button"
                        onClick={() => removeItem(index)}
                        variant="outline"
                        size="sm"
                        disabled={formData.items.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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
              <h3 className="text-lg font-semibold">Tax & Discount</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) =>
                      handleInputChange(
                        "taxRate",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="10"
                    className={errors.taxRate ? "border-red-500" : ""}
                  />
                  {errors.taxRate && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.taxRate}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="discountRate">Discount Rate (%)</Label>
                  <Input
                    id="discountRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discountRate}
                    onChange={(e) =>
                      handleInputChange(
                        "discountRate",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                    className={errors.discountRate ? "border-red-500" : ""}
                  />
                  {errors.discountRate && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.discountRate}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Payment Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
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
                  <Label htmlFor="bankAccount">Bank Account Number</Label>
                  <Input
                    id="bankAccount"
                    value={formData.bankAccount}
                    onChange={(e) =>
                      handleInputChange("bankAccount", e.target.value)
                    }
                    placeholder="123-456-7890"
                  />
                </div>
              </div>


            </div>

            <Separator />

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label htmlFor="terms">Terms & Conditions</Label>
                <textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => handleInputChange("terms", e.target.value)}
                  placeholder="Payment terms and conditions..."
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-6">
              <div className="space-x-2">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>

              <div className="space-x-2">
                <Button type="button" variant="outline" onClick={previewPDF}>
                  Preview PDF
                </Button>
                <Button type="button" variant="outline" onClick={downloadPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button type="submit">
                  {invoice ? "Update Invoice" : "Create Invoice"}
                </Button>
                <Button type="button" onClick={createAndDownloadPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Create & Download
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
