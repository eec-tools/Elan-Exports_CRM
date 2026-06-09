import type {
  CRMReportData,
  OutreachEntry,
  DealStageEntry,
  TaskEmployeeEntry,
  AttendanceEmployeeEntry,
} from "./dailyReportService.js";

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  navy:      "#1a1a2e",
  amber:     "#d97706",
  green:     "#16a34a",
  red:       "#dc2626",
  blue:      "#2563eb",
  purple:    "#7c3aed",
  cyan:      "#0891b2",
  slate:     "#64748b",
  lightGray: "#f8fafc",
  border:    "#e2e8f0",
  white:     "#ffffff",
};

// Deal stage colour map
const STAGE_COLORS: Record<string, string> = {
  "Communication":                              C.blue,
  "Price Approval by Buyer":                    C.amber,
  "Negotiation with Buyer":                     C.red,
  "No Ongoing Deal":                            C.slate,
  "Sampling":                                   C.cyan,
  "Orders Confirmed from Buyer":                C.green,
  "Timeline to be Established from Supplier":   C.amber,
  "Order Shipped & Shipping Docs Received":     C.green,
};

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const SVG = {
  factory: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M3.75 21V7.5l6-3v3l6-3v3l6-3V21M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>`,
  cart:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>`,
  briefcase: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>`,
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" style="display:inline-block;vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`,
};

function headerIcon(key: keyof typeof SVG, color: string): string {
  return SVG[key].replace('stroke="currentColor"', `stroke="${color}"`);
}

// ── Formatting helpers ─────────────────────────────────────────────────────────
function fmt(n: number): string { return n.toLocaleString("en-IN"); }

function dashIfZero(n: number): string { return n === 0 ? "—" : fmt(n); }


// ── Layout primitives ──────────────────────────────────────────────────────────

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

function emptyRow(cols: number, msg: string): string {
  return `<tr><td colspan="${cols}" style="padding:18px;text-align:center;color:${C.slate};font-size:12px;font-style:italic;">${msg}</td></tr>`;
}

// Small KPI card (6 per row, used inside dept sections)
function smallKpi(value: string, label: string, color: string): string {
  return `
    <td style="padding:3px;">
      <div style="background:${color}10;border:1.5px solid ${color}28;border-radius:8px;padding:10px 6px;text-align:center;">
        <div style="font-size:19px;font-weight:800;color:${color};line-height:1;">${value}</div>
        <div style="font-size:9px;color:${C.slate};margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;line-height:1.3;">${label}</div>
      </div>
    </td>`;
}

// Medium KPI card (2-4 per row, used in Deal & Task sections)
function medKpi(value: string, label: string, color: string): string {
  return `
    <td style="padding:4px;">
      <div style="background:${color}10;border:1.5px solid ${color}28;border-radius:10px;padding:16px 10px;text-align:center;">
        <div style="font-size:26px;font-weight:800;color:${color};line-height:1;">${value}</div>
        <div style="font-size:10px;color:${C.slate};margin-top:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${label}</div>
      </div>
    </td>`;
}

// Sub-section label inside a dept block
function subLabel(text: string): string {
  return `<div style="font-size:12px;font-weight:700;color:${C.navy};margin:12px 0 6px;padding-left:2px;">${text}</div>`;
}

// ── Section builders ───────────────────────────────────────────────────────────

function buildSuppliersSection(d: CRMReportData): string {
  const s = d.suppliers;
  const periodDesc = buildPeriodDesc(d);

  const kpiRow1 = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
      <tr>
        ${smallKpi(fmt(s.totalAdded),           "Suppliers Added",    C.amber)}
        ${smallKpi(dashIfZero(s.introEmailsSent),"Intro Emails Sent",  C.blue)}
        ${smallKpi(dashIfZero(s.fu1Sent),        "Follow-Up 1 Sent",   C.slate)}
        ${smallKpi(dashIfZero(s.fu2Sent),        "Follow-Up 2 Sent",   C.slate)}
        ${smallKpi(dashIfZero(s.fu3Sent),        "Follow-Up 3 Sent",   C.slate)}
        ${smallKpi(fmt(s.signedCount),           "Signed Suppliers",   C.green)}
      </tr>
    </table>`;

  const kpiRow2 = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td style="width:33.33%;padding:3px;">
          <div style="background:${C.blue}10;border:1.5px solid ${C.blue}28;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.blue};">${dashIfZero(s.respondedCount)}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">Responded</div>
          </div>
        </td>
        <td style="width:33.33%;padding:3px;">
          <div style="background:${C.green}10;border:1.5px solid ${C.green}28;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.green};">${fmt(s.inSourcingCount)}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">In Sourcing</div>
            <div style="font-size:9px;color:${C.slate};margin-top:2px;">(Follow-ups are going on)</div>
          </div>
        </td>
        <td style="width:33.33%;padding:3px;">
          <div style="background:${C.red}10;border:1.5px solid ${C.red}28;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.red};">${dashIfZero(s.invalidEmailCount)}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">Bounced / Invalid</div>
          </div>
        </td>
      </tr>
    </table>`;

  const outreachRows = s.teamOutreach.length
    ? s.teamOutreach.map((e: OutreachEntry, i: number) =>
        tableRow([
          e.name,
          dashIfZero(e.introSent),
          dashIfZero(e.fu1Sent),
          dashIfZero(e.fu2Sent),
          dashIfZero(e.fu3Sent),
          dashIfZero(e.totalEmails),
          e.signedCount > 0 ? badge(e.signedCount, C.green) : "—",
        ], i % 2 === 0)
      ).join("")
    : emptyRow(7, "No supplier dept employees found");

  const sTotIntro   = s.teamOutreach.reduce((a, e) => a + e.introSent,   0);
  const sTotFu1     = s.teamOutreach.reduce((a, e) => a + e.fu1Sent,     0);
  const sTotFu2     = s.teamOutreach.reduce((a, e) => a + e.fu2Sent,     0);
  const sTotFu3     = s.teamOutreach.reduce((a, e) => a + e.fu3Sent,     0);
  const sTotEmails  = s.teamOutreach.reduce((a, e) => a + e.totalEmails, 0);

  const totalRow = s.teamOutreach.length ? `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">TOTAL</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.blue};border-top:2px solid ${C.navy}25;">${dashIfZero(sTotIntro)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.slate};border-top:2px solid ${C.navy}25;">${dashIfZero(sTotFu1)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.slate};border-top:2px solid ${C.navy}25;">${dashIfZero(sTotFu2)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.slate};border-top:2px solid ${C.navy}25;">${dashIfZero(sTotFu3)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">${dashIfZero(sTotEmails)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.green};border-top:2px solid ${C.navy}25;">${s.totalSignedByTeam}</td>
    </tr>` : "";

  return `
    ${sectionHeader("Suppliers' Department Analytics", `Supplier sourcing, outreach &amp; conversion — ${periodDesc}`, C.amber, "factory")}
    <tr><td style="padding:10px 32px 0;">
      ${kpiRow1}
      ${kpiRow2}
      ${subLabel("Team Outreach Breakdown")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(
          ["Team Member","Intro Sent","Follow-Up 1","Follow-Up 2","Follow-Up 3","Total Emails","Signed Suppliers"],
          ["22%","12%","12%","12%","12%","13%","17%"]
        )}
        ${outreachRows}
        ${totalRow}
      </table>
      <div style="font-size:10px;color:${C.slate};margin-top:6px;font-style:italic;">* Email counts reflect campaigns sent during this period, attributed to the employee who sourced the supplier.</div>
    </td></tr>`;
}

function buildBuyersSection(d: CRMReportData): string {
  const b = d.buyers;
  const periodDesc = buildPeriodDesc(d);

  const kpiRow = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
      <tr>
        ${smallKpi(fmt(b.totalAdded),           "Buyers Added",       C.amber)}
        ${smallKpi(dashIfZero(b.introEmailsSent),"Intro Emails Sent",  C.blue)}
        ${smallKpi(dashIfZero(b.fu1Sent),        "Follow-Up 1 Sent",   C.slate)}
        ${smallKpi(dashIfZero(b.fu2Sent),        "Follow-Up 2 Sent",   C.slate)}
        ${smallKpi(dashIfZero(b.fu3Sent),        "Follow-Up 3 Sent",   C.slate)}
        ${smallKpi(dashIfZero(b.activeCount),    "Signed Buyers",      C.green)}
      </tr>
    </table>`;

  const kpiRow2Buyers = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td style="width:33.33%;padding:3px;">
          <div style="background:${C.blue}10;border:1.5px solid ${C.blue}28;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.blue};">${dashIfZero(b.respondedCount)}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">Responded</div>
          </div>
        </td>
        <td style="width:33.33%;padding:3px;">
          <div style="background:${C.green}10;border:1.5px solid ${C.green}28;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.green};">${fmt(b.inSourcingCount)}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">In Sourcing</div>
            <div style="font-size:9px;color:${C.slate};margin-top:2px;">(Follow-ups are going on)</div>
          </div>
        </td>
        <td style="width:33.33%;padding:3px;">
          <div style="background:${C.red}10;border:1.5px solid ${C.red}28;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:${C.red};">${dashIfZero(b.invalidEmailCount)}</div>
            <div style="font-size:10px;color:${C.slate};font-weight:700;text-transform:uppercase;margin-top:4px;">Bounced / Invalid</div>
          </div>
        </td>
      </tr>
    </table>`;

  const outreachRows = b.teamOutreach.length
    ? b.teamOutreach.map((e: OutreachEntry, i: number) =>
        tableRow([
          e.name,
          dashIfZero(e.introSent),
          dashIfZero(e.fu1Sent),
          dashIfZero(e.fu2Sent),
          dashIfZero(e.fu3Sent),
          dashIfZero(e.totalEmails),
          e.signedCount > 0 ? badge(e.signedCount, C.green) : "—",
        ], i % 2 === 0)
      ).join("")
    : emptyRow(7, "No buyer dept employees found");

  const bTotIntro   = b.teamOutreach.reduce((a, e) => a + e.introSent,   0);
  const bTotFu1     = b.teamOutreach.reduce((a, e) => a + e.fu1Sent,     0);
  const bTotFu2     = b.teamOutreach.reduce((a, e) => a + e.fu2Sent,     0);
  const bTotFu3     = b.teamOutreach.reduce((a, e) => a + e.fu3Sent,     0);
  const bTotEmails  = b.teamOutreach.reduce((a, e) => a + e.totalEmails, 0);

  const totalRow = b.teamOutreach.length ? `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">TOTAL</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.blue};border-top:2px solid ${C.navy}25;">${dashIfZero(bTotIntro)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.slate};border-top:2px solid ${C.navy}25;">${dashIfZero(bTotFu1)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.slate};border-top:2px solid ${C.navy}25;">${dashIfZero(bTotFu2)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.slate};border-top:2px solid ${C.navy}25;">${dashIfZero(bTotFu3)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">${dashIfZero(bTotEmails)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.green};border-top:2px solid ${C.navy}25;">${b.totalSignedByTeam}</td>
    </tr>` : "";

  return `
    ${sectionHeader("Buyers' Department Analytics", `Buyer sourcing, outreach &amp; conversion — ${periodDesc}`, C.blue, "cart")}
    <tr><td style="padding:10px 32px 0;">
      ${kpiRow}
      ${kpiRow2Buyers}
      ${subLabel("Team Outreach Breakdown")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(
          ["Team Member","Intro Sent","Follow-Up 1","Follow-Up 2","Follow-Up 3","Total Emails","Signed Buyers"],
          ["22%","12%","12%","12%","12%","13%","17%"]
        )}
        ${outreachRows}
        ${totalRow}
      </table>
      <div style="font-size:10px;color:${C.slate};margin-top:6px;font-style:italic;">* Email counts reflect campaigns sent during this period, attributed to the employee who sourced the buyer.</div>
    </td></tr>`;
}

function buildDealSection(d: CRMReportData): string {
  const deals = d.deals;
  const newLabel =
    d.reportType === "daily"   ? "New Deals Yesterday" :
    d.reportType === "weekly"  ? "New Deals This Week" : "New Deals This Month";

  const CRM_BASE = "https://crm.eectrade.com";

  const stageRows = deals.byStage.length
    ? deals.byStage.map((s: DealStageEntry, i: number) => {
        const color = STAGE_COLORS[s.stage] ?? C.slate;
        const stageCell = `<span style="color:${color};font-weight:700;">${s.stage}</span>`;
        const stageParam = encodeURIComponent(s.stage);
        const viewLink = `<a href="${CRM_BASE}/deals?stage=${stageParam}" style="display:inline-block;padding:4px 12px;background:${C.navy}12;color:${C.navy};border:1px solid ${C.navy}30;border-radius:20px;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">View Companies →</a>`;
        return tableRow([stageCell, fmt(s.count), viewLink], i % 2 === 0);
      }).join("")
    : emptyRow(3, "No active deals");

  const totalPipelineRow = deals.byStage.length ? `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">TOTAL ACTIVE PIPELINE</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">${fmt(deals.totalActive)}</td>
      <td style="padding:9px 14px;font-size:12px;border-top:2px solid ${C.navy}25;"><a href="${CRM_BASE}/deals" style="display:inline-block;padding:4px 12px;background:${C.green}12;color:${C.green};border:1px solid ${C.green}30;border-radius:20px;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">View All Deals →</a></td>
    </tr>` : "";

  return `
    ${sectionHeader("Deal Pipeline", `Current pipeline snapshot across all stages — ${fmt(deals.totalActive)} total active deals`, C.green, "briefcase")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          ${medKpi(fmt(deals.totalActive), "Total Active Deals", C.green)}
          ${medKpi(fmt(deals.newInPeriod), newLabel,             C.blue)}
          ${medKpi(fmt(deals.stale),       "Stale (7+ Days)",    C.amber)}
        </tr>
      </table>
      ${subLabel("Pipeline Stage Breakdown")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Pipeline Stage","Deals",""], ["55%","15%","30%"])}
        ${stageRows}
        ${totalPipelineRow}
      </table>
    </td></tr>`;
}

function buildTaskSection(d: CRMReportData): string {
  const tasks = d.tasks;
  const completedLabel =
    d.reportType === "daily"   ? "Completed Yesterday" :
    d.reportType === "weekly"  ? "Completed This Week" : "Completed This Month";
  const newLabel =
    d.reportType === "daily"   ? "New Tasks Yesterday" :
    d.reportType === "weekly"  ? "New Tasks This Week" : "New Tasks This Month";

  const tTotPending   = tasks.byEmployee.reduce((a, e) => a + e.pending,   0);
  const tTotCompleted = tasks.byEmployee.reduce((a, e) => a + e.completed, 0);
  const tTotClosed    = tasks.byEmployee.reduce((a, e) => a + e.closed,    0);

  const rows = tasks.byEmployee.length
    ? tasks.byEmployee.map((e: TaskEmployeeEntry, i: number) =>
        tableRow([
          e.name,
          e.pending   > 0 ? badge(e.pending,   C.amber)  : badge(0, C.slate),
          e.completed > 0 ? badge(e.completed, C.green)  : badge(0, C.slate),
          e.closed    > 0 ? badge(e.closed,    C.purple) : badge(0, C.slate),
        ], i % 2 === 0)
      ).join("")
    : emptyRow(4, "No task data available");

  const totalRow = tasks.byEmployee.length ? `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">TOTAL</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.amber};border-top:2px solid ${C.navy}25;">${fmt(tTotPending)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.green};border-top:2px solid ${C.navy}25;">${fmt(tTotCompleted)}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.purple};border-top:2px solid ${C.navy}25;">${fmt(tTotClosed)}</td>
    </tr>` : "";

  return `
    ${sectionHeader("Employee Analytics", "Task tracker &amp; workload summary per team member", C.purple, "clipboard")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          ${medKpi(fmt(tasks.totalPending),      "Total Pending",    C.amber)}
          ${medKpi(fmt(tasks.completedInPeriod), completedLabel,     C.green)}
          ${medKpi(fmt(tasks.createdInPeriod),   newLabel,           C.blue)}
          ${medKpi(fmt(tasks.totalCompleted),    "Total Completed",  C.green)}
        </tr>
      </table>
      ${subLabel("Task Tracker")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(["Employee","Pending","Completed","Closed"], ["40%","20%","20%","20%"])}
        ${rows}
        ${totalRow}
      </table>
    </td></tr>`;
}

function buildAttendanceSection(d: CRMReportData): string {
  if (!d.attendance) return "";
  const att = d.attendance;
  const periodDesc = d.reportType === "weekly"
    ? `Week: ${d.periodLabel}`
    : d.periodLabel;

  const rows = att.byEmployee.length
    ? att.byEmployee.map((e: AttendanceEmployeeEntry, i: number) =>
        tableRow([
          e.name,
          e.present   > 0 ? badge(e.present,   C.green)  : badge(0, C.slate),
          e.absent    > 0 ? badge(e.absent,    C.red)    : badge(0, C.slate),
          e.leave     > 0 ? badge(e.leave,     C.amber)  : badge(0, C.slate),
          e.halfDay   > 0 ? badge(e.halfDay,   C.purple) : badge(0, C.slate),
          e.weeklyOff > 0 ? badge(e.weeklyOff, C.slate)  : badge(0, C.slate),
        ], i % 2 === 0)
      ).join("")
    : emptyRow(6, "No attendance records for this period");

  const totalRow = att.byEmployee.length ? `
    <tr style="background:${C.navy}08;">
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.navy};border-top:2px solid ${C.navy}25;">TOTAL (Person-Days)</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.green};border-top:2px solid ${C.navy}25;">${att.totalPresent}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.red};border-top:2px solid ${C.navy}25;">${att.totalAbsent}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.amber};border-top:2px solid ${C.navy}25;">${att.totalLeave}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.purple};border-top:2px solid ${C.navy}25;">${att.totalHalfDay}</td>
      <td style="padding:9px 14px;font-size:12px;font-weight:800;color:${C.slate};border-top:2px solid ${C.navy}25;">${att.totalWeeklyOff}</td>
    </tr>` : "";

  return `
    ${sectionHeader("Attendance Summary", `Team attendance overview — ${periodDesc}`, C.purple, "users")}
    <tr><td style="padding:10px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          ${medKpi(fmt(att.totalPresent), "Present Days",   C.green)}
          ${medKpi(fmt(att.totalAbsent),  "Absent Days",    C.red)}
          ${medKpi(fmt(att.totalLeave),   "Leave Days",     C.amber)}
          ${medKpi(fmt(att.workingDays),  "Working Days",   C.blue)}
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};">
        ${tableHeader(
          ["Employee","Days Present","Days Absent","Leave","Half Day","Weekly Off"],
          ["30%","14%","14%","14%","14%","14%"]
        )}
        ${rows}
        ${totalRow}
      </table>
    </td></tr>`;
}

// ── Period description for section subtitles ───────────────────────────────────
function buildPeriodDesc(d: CRMReportData): string {
  if (d.reportType === "daily")   return d.periodLabel;
  if (d.reportType === "weekly")  return `Week: ${d.periodLabel}`;
  return d.periodLabel; // monthly: "June 2026"
}

// ── Main HTML builder ──────────────────────────────────────────────────────────
export function buildReportHtml(d: CRMReportData): string {
  const subtitle =
    d.reportType === "daily"   ? "Daily CRM Operations Digest"   :
    d.reportType === "weekly"  ? "Weekly CRM Operations Digest"  :
                                 "Monthly CRM Operations Digest";

  const reportForLabel =
    d.reportType === "daily"   ? `Report for: <strong>${d.periodLabel}</strong>` :
    d.reportType === "weekly"  ? `Weekly report: <strong>${d.periodLabel}</strong>` :
                                 `Monthly report: <strong>${d.periodLabel}</strong>`;

  const reportTypeLabel =
    d.reportType === "daily"   ? "Daily"   :
    d.reportType === "weekly"  ? "Weekly"  : "Monthly";

  const folderName = `${reportTypeLabel} Reports`;

  const scheduleText =
    d.reportType === "daily"
      ? "Auto-generated daily at 9:00 AM IST"
      : d.reportType === "weekly"
      ? "Auto-generated weekly at 9:00 AM IST (every Monday)"
      : "Auto-generated monthly at 9:00 AM IST (1st of each month)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Elan Exports — ${subtitle} ${d.periodLabel}</title>
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
            <div style="color:#94a3b8;font-size:12px;margin-top:4px;font-weight:500;">${subtitle}</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="background:${C.amber};color:${C.white};padding:5px 13px;border-radius:20px;font-size:11px;font-weight:700;">${d.dayBadge}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:14px;">
            <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:12px 16px;">
              <div style="color:${C.white};font-size:16px;font-weight:700;">${reportForLabel}</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:3px;">Generated ${d.generatedAt} IST &nbsp;|&nbsp; Sent to operations leadership</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr><td style="background:${C.amber};height:3px;"></td></tr>

  <!-- SUPPLIERS -->
  ${buildSuppliersSection(d)}

  <tr><td style="padding:4px 32px 0;"><hr style="border:none;border-top:1px solid ${C.border};margin:16px 0 0;"/></td></tr>

  <!-- BUYERS -->
  ${buildBuyersSection(d)}

  <tr><td style="padding:4px 32px 0;"><hr style="border:none;border-top:1px solid ${C.border};margin:16px 0 0;"/></td></tr>

  <!-- DEAL PIPELINE -->
  ${buildDealSection(d)}

  <tr><td style="padding:4px 32px 0;"><hr style="border:none;border-top:1px solid ${C.border};margin:16px 0 0;"/></td></tr>

  <!-- EMPLOYEE ANALYTICS -->
  ${buildTaskSection(d)}

  <!-- ATTENDANCE (weekly / monthly only) -->
  ${d.attendance ? `<tr><td style="padding:4px 32px 0;"><hr style="border:none;border-top:1px solid ${C.border};margin:16px 0 0;"/></td></tr>
  ${buildAttendanceSection(d)}` : ""}

  <!-- FOOTER -->
  <tr><td style="padding:24px 32px 18px;">
    <hr style="border:none;border-top:1px solid ${C.border};margin:20px 0 16px;"/>
    <div style="color:${C.slate};font-size:11px;line-height:1.8;text-align:center;">
      ${scheduleText} &nbsp;&middot;&nbsp; Data reflects activity on <strong>${d.periodLabel}</strong><br/>
      Saved in CRM Vault &rsaquo; <em>${folderName}</em> &rsaquo; <em>${d.periodLabel}</em> &nbsp;&middot;&nbsp; crm.eectrade.com
    </div>
  </td></tr>
  <tr><td style="background:${C.navy};height:5px;"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Backwards-compatible alias used by existing scheduler imports
export const buildDailyReportHtml = buildReportHtml;
