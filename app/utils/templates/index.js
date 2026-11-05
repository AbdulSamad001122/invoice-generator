// Template Manager for Invoice Templates
// This module provides a centralized way to manage multiple invoice templates
// while maintaining consistent data structure across all templates

import BlueModernTemplate from "./blue-modern-template";
import YellowClassicTemplate from "./yellow-classic-template";
import GreenModernTemplate from "./green-modern-template";
import GreenClassicTemplate from "./green-classic-template";
import { Font } from "@react-pdf/renderer";

// Never hyphenate words in PDFs: react-pdf otherwise inserts "-" when wrapping,
// which corrupts printed links/URLs and long names. Words wrap whole instead.
Font.registerHyphenationCallback((word) => [word]);

// Template registry - add new templates here (metadata lives in ./registry.js)
import {
  TEMPLATE_METADATA,
  DEFAULT_TEMPLATE,
  getDefaultTemplate,
  setDefaultTemplate,
} from "./registry";

export { DEFAULT_TEMPLATE, getDefaultTemplate, setDefaultTemplate };

const TEMPLATE_COMPONENTS = {
  "blue-modern": BlueModernTemplate,
  "yellow-classic": YellowClassicTemplate,
  "green-modern": GreenModernTemplate,
  "green-classic": GreenClassicTemplate,
};

export const INVOICE_TEMPLATES = Object.fromEntries(
  Object.entries(TEMPLATE_METADATA).map(([id, meta]) => [
    id,
    { ...meta, component: TEMPLATE_COMPONENTS[id] },
  ])
);

// Get all available templates
export const getAvailableTemplates = () => {
  return Object.values(INVOICE_TEMPLATES);
};

// Get template by ID
export const getTemplateById = (templateId) => {
  return INVOICE_TEMPLATES[templateId] || INVOICE_TEMPLATES[DEFAULT_TEMPLATE];
};

// Get template component
export const getTemplateComponent = (templateId) => {
  const template = getTemplateById(templateId);
  return template.component;
};

// Validate template data structure
export const validateInvoiceData = (invoiceData) => {
  const requiredFields = [
    "companyName",
    "companyEmail",
    "clientName",
    "clientEmail",
    "invoiceNumber",
    "invoiceDate",
    "dueDate",
    "items",
  ];

  const missingFields = requiredFields.filter((field) => {
    const value = invoiceData[field];
    return (
      value === undefined ||
      value === null ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "string" && value.trim() === "")
    );
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

// Standard data structure that all templates must support
export const TEMPLATE_DATA_STRUCTURE = {
  // Company Information
  companyName: "string",
  companyEmail: "string",
  companyLogo: "string|null",
  companyCustomFields: "array",

  // Client Information
  clientName: "string",
  clientEmail: "string",
  clientCustomFields: "array",

  // Invoice Details
  invoiceNumber: "string",
  invoiceDate: "string",
  dueDate: "string",
  status: "string",

  // Items
  items: "array", // [{itemName, description, quantity, rate, amount}]
  includeDescription: "boolean",

  // Financial
  taxRate: "number",
  discountRate: "number",

  // Additional
  notes: "string",
  terms: "string",
  bankName: "string",
  bankAccount: "string",
  showStatusOnPDF: "boolean",
};
