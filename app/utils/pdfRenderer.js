// Loads the PDF library and templates only when a PDF is actually generated.
// @react-pdf/renderer is large (~500 KB), so keeping it out of the initial
// page bundle makes the dashboard and invoice pages load much faster.

let pdfModulesPromise = null;

const loadPdfModules = () => {
  if (!pdfModulesPromise) {
    pdfModulesPromise = Promise.all([
      import("react"),
      import("@react-pdf/renderer"),
      import("./templates"),
    ]).catch((error) => {
      pdfModulesPromise = null; // allow a retry after a network error
      throw error;
    });
  }
  return pdfModulesPromise;
};

// Start downloading the PDF code in the background (e.g. when a form opens)
export const preloadPdfRenderer = () => {
  loadPdfModules().catch(() => {});
};

export async function renderInvoicePdfBlob(templateId, invoiceData) {
  const [React, { pdf }, { getTemplateComponent }] = await loadPdfModules();
  const TemplateComponent = getTemplateComponent(templateId);
  return pdf(React.createElement(TemplateComponent, { invoiceData })).toBlob();
}
