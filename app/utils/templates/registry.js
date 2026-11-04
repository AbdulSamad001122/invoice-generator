// Lightweight template metadata (no PDF code).
// Import this from UI components so the heavy @react-pdf/renderer library
// is only downloaded when a PDF is actually generated (see app/utils/pdfRenderer.js).

export const TEMPLATE_METADATA = {
  "blue-modern": {
    id: "blue-modern",
    name: "Blue Modern",
    description: "Professional blue template with curved header",
    preview: "/templates/blue-modern-preview.png",
  },
  "yellow-classic": {
    id: "yellow-classic",
    name: "Yellow Classic",
    description: "Classic yellow template with clean layout",
    preview: "/templates/yellow-classic-preview.png",
  },
  "green-modern": {
    id: "green-modern",
    name: "Green Modern",
    description: "Fresh and vibrant green-themed template",
    preview: "/templates/green-modern-preview.png",
  },
  "green-classic": {
    id: "green-classic",
    name: "Green Classic",
    description: "Classic green template with professional layout",
    preview: "/templates/green-classic-preview.png",
  },
};

// Default template - can be changed by user
export const INITIAL_DEFAULT_TEMPLATE = "blue-modern";

// Get user's preferred default template from localStorage
export const getDefaultTemplate = () => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("defaultTemplate");
    if (saved && TEMPLATE_METADATA[saved]) return saved;
  }
  return INITIAL_DEFAULT_TEMPLATE;
};

// Set user's preferred default template
export const setDefaultTemplate = (templateId) => {
  if (typeof window !== "undefined" && TEMPLATE_METADATA[templateId]) {
    localStorage.setItem("defaultTemplate", templateId);
    return true;
  }
  return false;
};

// For backward compatibility
export const DEFAULT_TEMPLATE = getDefaultTemplate();

// Get all available templates (metadata only)
export const getAvailableTemplates = () => Object.values(TEMPLATE_METADATA);

// Get template metadata by ID
export const getTemplateById = (templateId) =>
  TEMPLATE_METADATA[templateId] || TEMPLATE_METADATA[DEFAULT_TEMPLATE];
