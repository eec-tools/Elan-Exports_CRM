import type { DailyReportData, DealStageEntry, SupplierEntry, BuyerEntry, TaskEntry, AttendanceEntry } from "./dailyReportService.js";

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  navy:      "#1a1a2e",
  amber:     "#d97706",
  green:     "#16a34a",
  red:       "#dc2626",
  blue:      "#2563eb",
  purple:    "#7c3aed",
  slate:     "#64748b",
  lightGray: "#f8fafc",
  border:    "#e2e8f0",
  white:     "#ffffff",
};

// ── Names that should never appear in the task table ──────────────────────────
const EXCLUDED_TASK_NAMES = new Set([
  "fahad",
  "test",
  "parth singh",
  "n/a",
  "na",
]);

function isExcluded(name: string): boolean {
  return EXCLUDED_TASK_NAMES.has(name.toLowerCase().trim());
}

// ── Inline SVG icons (Heroicons stroke style, renders perfectly in Puppeteer) ─
const SVG = {
  factory: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M3.75 21V7.5l6-3v3l6-3v3l6-3V21M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21M9 9.75h.008v.008H9V9.75zm0 3h.008v.008H9v-.008zm0 3h.008v.008H9v-.008zm6-6h.008v.008H15V6.75zm0 3h.008v.008H15v-.008zm0 3h.008v.008H15v-.008z"/></svg>`,

  cart: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>`,

  send: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>`,

  inbox: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"/></svg>`,

  reply: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>`,

  check: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,

  envelope: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>`,

  briefcase: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>`,

  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>`,

  users: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`,

  signal: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.789M12 12h.008v.008H12V12z"/></svg>`,

  warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,

  clock: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,

  checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
};

// Helper: wrap SVG in a coloured container for KPI cards
function kpiIcon(svgKey: keyof typeof SVG, color: string): string {
  const svg = SVG[svgKey].replace('stroke="currentColor"', `stroke="${color}"`);
  return `<div style="width:36px;height:36px;background:${color}20;border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;">${svg.replace('width="18" height="18"', 'width="20" height="20"')}</div>`;
}

// Helper: coloured SVG for section header
function headerIcon(svgKey: keyof typeof SVG, color: string): string {
  return SVG[svgKey].replace('stroke="currentColor"', `stroke="${color}"`);
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtCurrency(amount: number): string {
  if (amount === 0) return "—";
  if (amount >= 10_000_000) return `$${(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000) return `$${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

function kpi(value: number | string, label: string, bg: string, iconKey: keyof typeof SVG): string {
  return `
    <td style="width:16.6%;padding:6px;">
      <div style="background:${bg}10;border:1.5px solid ${bg}28;border-radius:10px;padding:14px 10px;text-align:center;">
        ${kpiIcon(iconKey, bg)}
        <div style="font-size:22px;font-weight:800;color:${bg};line-height:1;">${value}</div>
        <div style="font-size:10px;color:#64748b;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${label}</div>
      </div>
    </td>`;
}

function sectionHeader(title: string, subtitle: string, color: string, iconKey: keyof typeof SVG): string {
  return `
    <tr>
      <td style="padding:28px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-left:4px solid ${color};padding-left:12px;">
              <div style="font-size:15px;font-weight:800;color:${C.navy};letter-spacing:0.2px;">
                ${headerIcon(iconKey, color)}&nbsp;&nbsp;${title}
              </div>
              <div style="font-size:11px;color:${C.slate};margin-top:3px;">${subtitle}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function tableHeader(cols: string[], widths?: string[]): string {
  return `
    <tr style="background:${C.navy};">
      ${cols.map((col, i) =>
        `<th style="padding:10px 14px;text-align:left;color:${C.white};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;${widths ? `width:${widths[i]};` : ""}">${col}</th>`
      ).join("")}
    </tr>`;
}

function tableRow(cells: string[], isOdd: boolean): string {
  const bg = isOdd ? C.lightGray : C.white;
  return `
    <tr style="background:${bg};">
      ${cells.map((cell, i) =>
        `<td style="padding:9px 14px;font-size:12px;color:${C.navy};border-bottom:1px solid ${C.border};${i === 0 ? "font-weight:600;" : ""}">${cell}</td>`
      ).join("")}
    </tr>`;
}

function badge(text: string | number, color: string): string {
  return `<span style="background:${color}18;color:${color};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;">${text}</span>`;
}

function emptyRow(cols: number, message: string): string {
  return `<tr><td colspan="${cols}" style="padding:18px;text-align:center;color:${C.slate};font-size:12px;font-style:italic;">${message}</td></tr>`;
}

// ── Sections ───────────────────────────────────────────────────────────────────

function buildKpiRow(d: DailyReportData): string {
  return `
    <tr>
      <td style="padding:16px 24px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${kpi(d.totalSuppliersAdded, "Suppliers Added", C.blue,   "factory")}
            ${kpi(d.totalBuyersAdded,    "Buyers Added",    C.purple,  "cart")}
            ${kpi(d.totalEmailsSent,     "Emails Sent",     C.amber,   "send")}
            ${kpi(d.totalResponsesReceived, "Responses In", C.green,   "inbox")}
            ${kpi(d.totalRepliesSent,    "Replies Sent",    C.navy,    "reply")}
            ${kpi(d.tasks.completedYesterday, "Tasks Done", C.green,   "check")}
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildSupplierSection(d: DailyReportData): string {
  const rows = d.suppliers.byEmployee.length
    ? d.suppliers.byEmployee.map((e: SupplierEntry, i: number) =>
        tableRow([
          e.name,
          e.signed      ? badge(e.signed, C.green)      : "—",
          e.newSuppliers ? badge(e.newSuppliers, C.blue) : "—",
          e.sourcing    ? badge(e.sourcing, C.amber)     : "—",
          badge(e.total, C.navy),
        ], i % 2 === 0)
      ).join("")
    : emptyRow(5, "No suppliers added yesterday");

  const totals = `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;color:${C.navy};border-top:2px solid ${C.navy}25;font-weight:800;">TOTAL</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.green};border-top:2px solid ${C.navy}25;font-weight:800;">${d.suppliers.totalSigned}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.blue};border-top:2px solid ${C.navy}25;font-weight:800;">${d.suppliers.totalNew}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.amber};border-top:2px solid ${C.navy}25;font-weight:800;">${d.suppliers.totalSourcing}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.navy};border-top:2px solid ${C.navy}25;font-weight:800;">${d.totalSuppliersAdded}</td>
    </tr>`;

  return `
    ${sectionHeader("Supplier Pipeline", "Contacts added yesterday by team member", C.blue, "factory")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Employee", "Signed", "New / Onboarding", "Sourcing", "Total"], ["30%", "17%", "18%", "18%", "17%"])}
        ${rows}
        ${d.suppliers.byEmployee.length ? totals : ""}
      </table>
    </td></tr>`;
}

function buildBuyerSection(d: DailyReportData): string {
  const rows = d.buyers.byEmployee.length
    ? d.buyers.byEmployee.map((e: BuyerEntry, i: number) =>
        tableRow([
          e.name,
          e.active   ? badge(e.active, C.purple)  : "—",
          e.sourcing ? badge(e.sourcing, C.amber)  : "—",
          badge(e.total, C.navy),
        ], i % 2 === 0)
      ).join("")
    : emptyRow(4, "No buyers added yesterday");

  const totals = `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;color:${C.navy};border-top:2px solid ${C.navy}25;font-weight:800;">TOTAL</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.purple};border-top:2px solid ${C.navy}25;font-weight:800;">${d.buyers.totalActive}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.amber};border-top:2px solid ${C.navy}25;font-weight:800;">${d.buyers.totalSourcing}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.navy};border-top:2px solid ${C.navy}25;font-weight:800;">${d.totalBuyersAdded}</td>
    </tr>`;

  return `
    ${sectionHeader("Buyer Pipeline", "Contacts added yesterday by team member", C.purple, "cart")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Employee", "Active Buyers", "Sourcing Buyers", "Total"], ["30%", "23%", "24%", "23%"])}
        ${rows}
        ${d.buyers.byEmployee.length ? totals : ""}
      </table>
    </td></tr>`;
}

function buildEmailSection(d: DailyReportData): string {
  const ea = d.emailActivity;
  const rows = [
    tableRow(["Intro Emails Sent",       badge(ea.introsSent, C.blue),          "First contact emails dispatched"], true),
    tableRow(["Follow-up Emails Sent",   badge(ea.followupsSent, C.amber),       "Follow-up 1 / 2 / 3 sent"], false),
    tableRow(["Total Emails Sent",       badge(ea.sentTotal, C.navy),            "Intro + all follow-ups combined"], true),
    tableRow(["Supplier Responses In",   badge(ea.supplierResponses, C.green),   "Replies received from suppliers"], false),
    tableRow(["Buyer Responses In",      badge(ea.buyerResponses, C.green),      "Replies received from buyers"], true),
    tableRow(["Total Responses Received",badge(ea.responsesReceived, C.green),   "All inbound replies combined"], false),
    tableRow(["Replies Sent by Team",    badge(ea.repliesSentByUs, C.purple),    "Our outbound replies to incoming email"], true),
  ].join("");

  return `
    ${sectionHeader("Email Activity", "All campaign and reply activity from yesterday", C.amber, "envelope")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Metric", "Count", "Description"], ["35%", "20%", "45%"])}
        ${rows}
      </table>
    </td></tr>`;
}

function buildDealSection(d: DailyReportData): string {
  const stageColors: Record<string, string> = {
    Communication: C.blue,
    Negotiation:   C.amber,
    Agreement:     C.purple,
    Delivery:      C.green,
  };

  const stageRows = d.deals.byStage.length
    ? d.deals.byStage.map((s: DealStageEntry, i: number) =>
        tableRow([
          badge(s.stage, stageColors[s.stage] ?? C.slate),
          fmt(s.count),
          fmtCurrency(s.totalRevenue),
        ], i % 2 === 0)
      ).join("")
    : emptyRow(3, "No active deals");

  const alertBg    = d.deals.atRisk > 0 ? "#fef2f2" : "#f0fdf4";
  const alertColor = d.deals.atRisk > 0 ? C.red      : C.green;
  const alertIcon  = d.deals.atRisk > 0
    ? SVG.warning.replace('stroke="currentColor"', `stroke="${C.red}"`)
    : SVG.checkCircle.replace('stroke="currentColor"', `stroke="${C.green}"`);
  const alertText  = d.deals.atRisk > 0
    ? `${d.deals.atRisk} deal${d.deals.atRisk > 1 ? "s" : ""} with no activity in 7+ days`
    : "All active deals have recent activity";

  return `
    ${sectionHeader("Deal Pipeline", "Current pipeline snapshot across all stages", C.green, "briefcase")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Stage", "Deals", "Expected Revenue"], ["40%", "20%", "40%"])}
        ${stageRows}
        ${d.deals.byStage.length ? `
          <tr style="background:${C.navy}08;">
            <td style="padding:9px 14px;font-size:12px;color:${C.navy};border-top:2px solid ${C.navy}25;font-weight:800;">TOTAL ACTIVE PIPELINE</td>
            <td style="padding:9px 14px;font-size:12px;color:${C.navy};border-top:2px solid ${C.navy}25;font-weight:800;">${fmt(d.deals.byStage.reduce((s, x) => s + x.count, 0))}</td>
            <td style="padding:9px 14px;font-size:12px;color:${C.green};border-top:2px solid ${C.navy}25;font-weight:800;">${fmtCurrency(d.deals.totalActivePipelineRevenue)}</td>
          </tr>` : ""}
      </table>
    </td></tr>
    <tr><td style="padding:8px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="width:50%;padding:4px;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:${C.blue};">${d.deals.newToday}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:3px;">New Deals Yesterday</div>
          </div>
        </td>
        <td style="width:50%;padding:4px;">
          <div style="background:${alertBg};border:1px solid ${alertColor}30;border-radius:8px;padding:12px 16px;text-align:center;">
            <div style="font-size:12px;color:${alertColor};font-weight:600;">${alertIcon}&nbsp;${alertText}</div>
          </div>
        </td>
      </tr></table>
    </td></tr>`;
}

function buildTaskSection(d: DailyReportData): string {
  // Filter out test/fake employee entries
  const filtered = d.tasks.byEmployee.filter((e: TaskEntry) => !isExcluded(e.name));

  const rows = filtered.length
    ? filtered.map((e: TaskEntry, i: number) => {
        const overdueCell = e.overdue > 0
          ? `<span style="background:#fef2f2;color:${C.red};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;">${e.overdue}</span>`
          : badge(0, C.slate);
        return tableRow([
          e.name,
          e.pending    ? badge(e.pending, C.amber)   : badge(0, C.slate),
          e.inProgress ? badge(e.inProgress, C.blue) : badge(0, C.slate),
          e.completed  ? badge(e.completed, C.green) : badge(0, C.slate),
          overdueCell,
        ], i % 2 === 0);
      }).join("")
    : emptyRow(5, "No task data available");

  const totalPending    = filtered.reduce((s, t) => s + t.pending, 0);
  const totalInProgress = filtered.reduce((s, t) => s + t.inProgress, 0);
  const totalCompleted  = filtered.reduce((s, t) => s + t.completed, 0);
  const totalOverdue    = filtered.reduce((s, t) => s + t.overdue, 0);

  const totals = `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">TOTAL</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.amber};border-top:2px solid ${C.navy}25;font-weight:800;">${totalPending}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.blue};border-top:2px solid ${C.navy}25;font-weight:800;">${totalInProgress}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.green};border-top:2px solid ${C.navy}25;font-weight:800;">${totalCompleted}</td>
      <td style="padding:9px 14px;font-size:12px;color:${C.red};border-top:2px solid ${C.navy}25;font-weight:800;">${totalOverdue}</td>
    </tr>`;

  return `
    ${sectionHeader("Task Tracker", "Current task status per team member", C.amber, "clipboard")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Employee", "Pending", "In Progress", "Completed", "Overdue"])}
        ${rows}
        ${filtered.length ? totals : ""}
      </table>
    </td></tr>
    <tr><td style="padding:8px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="width:50%;padding:4px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:${C.green};">${d.tasks.completedYesterday}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:3px;">Completed Yesterday</div>
          </div>
        </td>
        <td style="width:50%;padding:4px;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:${C.blue};">${d.tasks.createdYesterday}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:3px;">New Tasks Yesterday</div>
          </div>
        </td>
      </tr></table>
    </td></tr>`;
}

function buildAttendanceSection(d: DailyReportData): string {
  const statusColor: Record<string, string> = {
    Present:   C.green,
    Absent:    C.red,
    Leave:     C.amber,
    HalfDay:   C.purple,
    WeeklyOff: C.slate,
  };

  const attendanceRows = d.attendance.details.length
    ? d.attendance.details.map((e: AttendanceEntry, i: number) => {
        const color = statusColor[e.status] ?? C.slate;
        const statusBadge = `<span style="background:${color}18;color:${color};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;">${e.status}</span>`;
        return tableRow([e.name, statusBadge, e.hours ?? "—"], i % 2 === 0);
      }).join("")
    : emptyRow(3, "No attendance records for yesterday");

  const attendanceRate = d.attendance.total > 0
    ? Math.round((d.attendance.present / d.attendance.total) * 100)
    : 0;
  const rateColor = attendanceRate >= 80 ? C.green : attendanceRate >= 60 ? C.amber : C.red;

  const statCards = [
    { label: "Present",    val: d.attendance.present,  color: C.green  },
    { label: "Absent",     val: d.attendance.absent,   color: C.red    },
    { label: "On Leave",   val: d.attendance.onLeave,  color: C.amber  },
    { label: "Half Day",   val: d.attendance.halfDay,  color: C.purple },
    { label: "Weekly Off", val: d.attendance.weeklyOff,color: C.slate  },
  ].map(({ label, val, color }) => `
    <td style="padding:4px;">
      <div style="background:${color}10;border:1.5px solid ${color}28;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:${color};">${val}</div>
        <div style="font-size:10px;color:${C.slate};font-weight:600;margin-top:2px;">${label}</div>
      </div>
    </td>`).join("");

  return `
    ${sectionHeader("Attendance", "Yesterday's team attendance summary", C.purple, "users")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${statCards}
        <td style="padding:4px;">
          <div style="background:${rateColor}10;border:1.5px solid ${rateColor}28;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:18px;font-weight:800;color:${rateColor};">${attendanceRate}%</div>
            <div style="font-size:10px;color:${C.slate};font-weight:600;margin-top:2px;">Rate</div>
          </div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:8px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Team Member", "Status", "Hours Worked"], ["40%", "30%", "30%"])}
        ${attendanceRows}
      </table>
    </td></tr>`;
}

function buildCampaignSection(d: DailyReportData): string {
  const leaveColor = d.pendingLeaves > 0 ? C.amber : C.green;
  const leaveIcon  = d.pendingLeaves > 0
    ? SVG.clock.replace('stroke="currentColor"', `stroke="${C.amber}"`)
    : SVG.checkCircle.replace('stroke="currentColor"', `stroke="${C.green}"`);
  const leaveText  = d.pendingLeaves > 0
    ? `${d.pendingLeaves} leave approval${d.pendingLeaves > 1 ? "s" : ""} pending`
    : "No pending leave approvals";

  return `
    ${sectionHeader("Campaign Health & Alerts", "Email campaign pipeline status and admin actions", C.green, "signal")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:4px;width:25%;">
          <div style="background:${C.amber}10;border:1.5px solid ${C.amber}28;border-radius:8px;padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.amber};">${d.campaigns.dueToday}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">Follow-ups Due</div>
          </div>
        </td>
        <td style="padding:4px;width:25%;">
          <div style="background:${C.blue}10;border:1.5px solid ${C.blue}28;border-radius:8px;padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.blue};">${d.campaigns.totalActive}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">Active Campaigns</div>
          </div>
        </td>
        <td style="padding:4px;width:25%;">
          <div style="background:${C.purple}10;border:1.5px solid ${C.purple}28;border-radius:8px;padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.purple};">${d.campaigns.awaitingResponse}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">Awaiting Response</div>
          </div>
        </td>
        <td style="padding:4px;width:25%;">
          <div style="background:${leaveColor}10;border:1.5px solid ${leaveColor}28;border-radius:8px;padding:14px;text-align:center;">
            <div style="font-size:12px;color:${leaveColor};font-weight:600;">${leaveIcon}&nbsp;${leaveText}</div>
          </div>
        </td>
      </tr></table>
    </td></tr>`;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function buildDailyReportHtml(d: DailyReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Elan Exports — CRM Daily Digest ${d.reportDate}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="background:${C.white};border-radius:12px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 4px 16px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr>
    <td style="background:${C.navy};padding:26px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="color:${C.white};font-size:21px;font-weight:800;letter-spacing:0.4px;">Elan Exports &amp; Consultancy</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:4px;font-weight:500;">Daily CRM Operations Digest</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="background:${C.amber};color:${C.white};padding:5px 13px;border-radius:20px;font-size:11px;font-weight:700;">${d.dayOfWeek.toUpperCase()}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:14px;">
            <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:12px 16px;">
              <div style="color:${C.white};font-size:16px;font-weight:700;">Report for: ${d.reportDate}</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:3px;">Generated ${d.generatedAt} IST &nbsp;|&nbsp; Sent to operations leadership</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr><td style="background:${C.amber};height:3px;"></td></tr>

  <!-- KPI -->
  <tr><td style="padding:16px 24px 0;">
    <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;letter-spacing:1px;">At a Glance — Yesterday's Performance</div>
  </td></tr>
  ${buildKpiRow(d)}

  <tr><td style="padding:4px 32px 0;"><hr style="border:none;border-top:1px solid ${C.border};margin:0;"/></td></tr>

  ${buildSupplierSection(d)}
  ${buildBuyerSection(d)}
  ${buildEmailSection(d)}
  ${buildDealSection(d)}
  ${buildTaskSection(d)}
  ${buildAttendanceSection(d)}
  ${buildCampaignSection(d)}

  <!-- FOOTER -->
  <tr><td style="padding:24px 32px 18px;">
    <hr style="border:none;border-top:1px solid ${C.border};margin:0 0 16px;"/>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="color:${C.slate};font-size:11px;line-height:1.7;">
          <strong style="color:${C.navy};">Elan Exports &amp; Consultancy</strong><br/>
          Auto-generated daily at 9:00 AM IST. Data reflects activity on <strong>${d.reportDate}</strong>.<br/>
          Saved in CRM Vault under <em>Daily Reports / ${d.reportDate}</em>.
        </div>
      </td>
      <td style="text-align:right;vertical-align:bottom;">
        <div style="font-size:10px;color:#94a3b8;">crm.eectrade.com</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${C.navy};height:5px;"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
