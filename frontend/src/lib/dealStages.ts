// Single source of truth for deal pipeline stages.
// Existing stage IDs (1-10) are preserved exactly to avoid breaking DB data.
// Post-shipment stages (11-18) are appended safely.

export type StageConfig = {
  id: string;
  label: string;
  color: string;
  bg: string;
  text: string;
};

export const DEAL_STAGE_CONFIG: StageConfig[] = [
  { id: "Communication", label: "Communication", color: "#64748b", bg: "#f1f5f9", text: "#334155" },
  { id: "Sampling", label: "Sampling", color: "#8b5cf6", bg: "#f5f3ff", text: "#6d28d9" },
  { id: "Quotation", label: "Quotation", color: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  { id: "Negotiation with EEC", label: "Negotiation with EEC", color: "#f59e0b", bg: "#fffbeb", text: "#b45309" },
  { id: "Price quotation to Buyer after EEC approval", label: "Price quotation to Buyer", color: "#06b6d4", bg: "#ecfeff", text: "#0e7490" },
  { id: "Negotiation with buyer", label: "Negotiation with buyer", color: "#f97316", bg: "#fff7ed", text: "#c2410c" },
  { id: "Price approval by buyer", label: "Price approval by buyer", color: "#10b981", bg: "#ecfdf5", text: "#065f46" },
  { id: "Quotation send to the supplier from buyer end", label: "Quotation to supplier", color: "#14b8a6", bg: "#f0fdfa", text: "#115e59" },
  { id: "Orders confirmed from buyers end", label: "Orders confirmed", color: "#16a34a", bg: "#f0fdf4", text: "#14532d" },
  { id: "Timeline (Product shipping.. etc) should be established from suppliers end", label: "Timeline established", color: "#22c55e", bg: "#f0fdf4", text: "#166534" },
  // Post-shipment stages — appended without renaming existing stages
  { id: "Shipment Dispatched", label: "Shipment Dispatched", color: "#0ea5e9", bg: "#f0f9ff", text: "#0369a1" },
  { id: "Documents Prepared", label: "Documents Prepared", color: "#7c3aed", bg: "#f5f3ff", text: "#5b21b6" },
  { id: "Customs & In Transit", label: "Customs & In Transit", color: "#dc2626", bg: "#fef2f2", text: "#991b1b" },
  { id: "Goods Delivered", label: "Goods Delivered", color: "#059669", bg: "#ecfdf5", text: "#065f46" },
  { id: "Commission Confirmation", label: "Commission Confirmation", color: "#d97706", bg: "#fffbeb", text: "#92400e" },
  { id: "Buyer Payment Follow-Up", label: "Buyer Payment Follow-Up", color: "#e11d48", bg: "#fff1f2", text: "#9f1239" },
  { id: "Claim Resolution", label: "Claim Resolution", color: "#7c3aed", bg: "#faf5ff", text: "#4c1d95" },
  { id: "Supplier Evaluation & Reorder", label: "Supplier Evaluation & Reorder", color: "#0f766e", bg: "#f0fdfa", text: "#134e4a" },
];

// Short labels for charts and compact views
export const STAGE_SHORT: Record<string, string> = {
  "Communication": "Communication",
  "Sampling": "Sampling",
  "Quotation": "Quotation",
  "Negotiation with EEC": "Neg. EEC",
  "Price quotation to Buyer after EEC approval": "Price to Buyer",
  "Negotiation with buyer": "Neg. Buyer",
  "Price approval by buyer": "Price Approved",
  "Quotation send to the supplier from buyer end": "Quote to Supplier",
  "Orders confirmed from buyers end": "Orders Confirmed",
  "Timeline (Product shipping.. etc) should be established from suppliers end": "Timeline Est.",
  "Shipment Dispatched": "Shipment",
  "Documents Prepared": "Docs Prepared",
  "Customs & In Transit": "Customs",
  "Goods Delivered": "Delivered",
  "Commission Confirmation": "Commission",
  "Buyer Payment Follow-Up": "Buyer Payment",
  "Claim Resolution": "Claims",
  "Supplier Evaluation & Reorder": "Reorder",
};
