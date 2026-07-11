# Reports Module — Business-Level Implementation Plan

## Overview

This document describes the full implementation plan for a structured **Reports Section** in the Élan Exports CRM. The reports are analytical, decision-making tools for management — not just data dumps. Each report is designed around the core business questions that leadership, sales, and sourcing teams need answered on a daily/weekly/monthly basis.

The Reports section will sit alongside the existing "Report Tracker" in a sidebar dropdown (styled like the Suppliers section), with three analytics-grade sub-reports:

1. **Buyers Report** — Portfolio health, deal pipeline, regional exposure, revenue potential
2. **Suppliers Report** — New / Signed / Old supplier pipeline health and operational metrics
3. **Employees Report** — Sourcing performance and supplier attribution per employee

---

## Sidebar Structure Change

Transform the current single `/reports` link into an expandable section like "Suppliers Area":

```
Reports
├── Report Tracker       (/reports)                  ← existing page, unchanged
├── Buyers Report        (/reports/buyers)            ← new
├── Suppliers Report     (/reports/suppliers)         ← new (tabbed: New / Signed / Old)
└── Employees Report     (/reports/employees)         ← new
```

The section will use the same collapsible sidebar pattern already implemented for Suppliers. Permission check: `reports` permission (read level). The 3 new report pages are view-only analytics — no create/edit/delete operations.

---

## 1. Buyers Report (`/reports/buyers`)

### Business Purpose
Understand the health and distribution of the buyer portfolio, identify high-value opportunities, track deal pipeline per buyer, and flag under-engaged or at-risk relationships.

### KPI Cards Row (top of page)

| Card | Value | Subtext |
|------|-------|---------|
| Total Buyers | count | Active / Pending / Suspended breakdown |
| Total Pipeline Value | sum of `expectedRevenue` across all deals linked to buyers | From active deals only |
| Countries Covered | distinct country count | Across all buyers |
| High Risk Buyers | count where `riskRating = High` | Needs attention |
| Buyers with No Deals | count | Potential to nurture |
| Avg Deal Value | total pipeline / deal count | Per buyer |

### Charts

**Row 1 — Portfolio Composition:**
- **Buyer Status Breakdown** (Donut Chart) — Active / Pending / Suspended counts. Business use: understand how much of the pipeline is unactivated.
- **Buyers by Region / Country** (Horizontal Bar Chart, top 10 countries) — Reveals geographic concentration risk. If 80% of buyers are from one country, management needs to know.

**Row 2 — Deal & Revenue Intelligence:**
- **Top 10 Buyers by Pipeline Value** (Bar Chart) — `expectedRevenue` aggregated from `deals` where `buyer` matches buyer `name`. Sorted descending. Business use: prioritize relationship management time.
- **Deal Stage Distribution Across Buyer Portfolio** (Stacked Bar) — For each deal stage (Communication → Orders Confirmed → Timeline Established), show how many deals are at that stage across all buyers. Business use: identify bottlenecks in the sales funnel.

**Row 3 — Product & Risk Intelligence:**
- **Product Category Demand Map** (Bar Chart) — Aggregate `productCategoryInterest` across all buyers. Shows which product categories have the most buyer demand — useful for sourcing prioritization.
- **Risk Rating Distribution** (Pie Chart) — Low / Medium / High. Overlay: if high-risk buyers have the highest pipeline value, that's a management alert.
- **Buyer Acquisition Trend** (Line Chart, monthly, last 12 months) — Count of new buyers added per month. Identifies growth trends or slowdowns.

### Data Tables

**Buyer Performance Table** (searchable, sortable, paginated):

| Column | Source |
|--------|--------|
| Buyer Name | `buyers.name` |
| Company | `buyers.company` |
| Country | `buyers.country` |
| Status | `buyers.status` (badge) |
| Risk Rating | `buyers.riskRating` (color-coded) |
| Products Interested | `buyers.productCategoryInterest` |
| # Linked Suppliers | `buyers.supplierLinks.length` |
| # Active Deals | count of deals where buyer matches |
| Pipeline Value | sum of `deals.expectedRevenue` |
| Last Deal Stage | latest deal's `stage` |
| Region | `buyers.region` |

**Buyers with No Deals** (separate tab/table):
Buyers who exist in the system but have zero linked deals — these are leads that haven't been converted into active negotiations. Shows: Buyer, Company, Country, Status, Created Date, Days Since Added.

**Buyers with No Linked Suppliers:**
Buyers with deals but no `supplierLinks` — risk of deal falling through because no supplier is committed.

### Filters
- Date range (buyer created date)
- Country / Region
- Status (Active / Pending / Suspended)
- Risk Rating
- Has deals (yes/no)

### Export
- PDF: KPI cards + charts (as images via canvas capture) + all 3 tables
- Excel: Three sheets — Overview Stats, Full Buyer Table, No-Deal Buyers

---

## 2. Suppliers Report (`/reports/suppliers`)

### Business Purpose
Track the health of each stage of the supplier pipeline — from initial outreach (Sourcing) through onboarding (New) to active partnerships (Signed) and historical archive (Old). Each sub-report answers a different operational question.

The page uses **tabs** for New / Signed / Old — consistent with how the existing supplier section works.

---

### Tab A: New Suppliers Report

**Business Question:** How effectively are we onboarding suppliers who expressed interest? Where are they getting stuck?

#### KPI Cards

| Card | Value |
|------|-------|
| Total New Suppliers | count |
| Form Submitted | count where form fields filled |
| Intro Email Sent | count where `introEmailSentAt` is set (via NewSupplierEmailCampaign) |
| Responded | count where response received |
| Avg Days to Respond | avg time from intro sent to response |
| Countries | distinct country count |

#### Charts

- **Onboarding Funnel** (Funnel / Waterfall Chart):
  Added → Form Submitted → Intro Sent → Followup 1 → Followup 2 → Response Received
  Business use: where exactly do suppliers drop off? If 80 suppliers received intro but only 10 responded, the email template needs work.

- **New Suppliers by Country** (Bar Chart) — Which countries are we sourcing from in the onboarding phase?

- **Product Category Coverage** (Bar Chart) — What products are these new suppliers offering? Gap analysis vs buyer demand.

- **Time in Onboarding** (Histogram or grouped bar) — Days since added, grouped: 0-7 days, 8-14, 15-30, 30-60, 60+ days. Suppliers sitting 60+ days in "new" phase without conversion are a problem.

- **Monthly Additions Trend** (Line Chart, 12 months) — How many new suppliers were added each month?

#### Table: New Supplier Status Table

| Column | Source |
|--------|--------|
| Company | `new_suppliers.company` |
| Country | `new_suppliers.country` |
| Contact Person | `new_suppliers.contactPerson` |
| Products | `new_suppliers.products` |
| Email Status | from `NewSupplierEmailCampaign` |
| Form Submitted | boolean |
| Days in Pipeline | today − createdAt |
| Converted From Sourcing | boolean (convertedFromSourcingId set) |
| Added By | user who created the record |

---

### Tab B: Signed Suppliers Report

**Business Question:** How is our active supplier base performing? Which suppliers are generating deals? What is our margin and vetting quality?

#### KPI Cards

| Card | Value |
|------|-------|
| Total Signed Suppliers | count |
| Suppliers with Active Deals | count where linked deal is in mid-stages |
| Avg Vetting Score | avg of `vettingScore` |
| Avg EEC Margin % | avg of `eecMarginPercent` |
| Countries | distinct country count |
| HACCP Certified | count where `haccpAvailable = true` |
| Organic Certified | count where organic cert filled |

#### Charts

- **Suppliers by Deal Stage** (Bar Chart) — For each deal stage, how many signed suppliers have deals at that stage? Business use: see which suppliers are actively in negotiation vs idle.

- **Top 10 Suppliers by Deal Value** (Horizontal Bar) — Aggregate `expectedRevenue` from deals linked to each supplier.

- **Vetting Score Distribution** (Histogram) — Group suppliers by score range (0-25, 26-50, 51-75, 76-100). Low-score suppliers in active deals = operational risk.

- **EEC Margin % Distribution** (Bar Chart) — Shows profitability spread. Are we over-relying on low-margin suppliers?

- **Certification Coverage** (Grouped Bar or Radar Chart):
  HACCP | ISO | Organic | FSSAI | APEDA | FDA — what % of signed suppliers have each cert? Critical for buyer compliance requirements.

- **Suppliers by Country** (Map/Bar Chart, top countries) — Geographic diversification of supply base.

- **Payment Terms Breakdown** (Donut Chart) — LC / TT in advance / DA / DP / other. Business use: understand cash flow risk profile of supplier base.

- **Production Capacity Overview** (Bar Chart, top 10 by capacity) — `avgMonthlyVolume` per supplier. Identifies which suppliers can scale for large orders.

#### Table: Signed Supplier Performance Table

| Column | Source |
|--------|--------|
| Company | `suppliers.company` |
| Country | `suppliers.country` |
| Products | `suppliers.products` |
| Deal Stage | `suppliers.dealStage` |
| Vetting Score | `suppliers.vettingScore` |
| EEC Margin % | `suppliers.eecMarginPercent` |
| Avg Monthly Volume | `suppliers.avgMonthlyVolume` |
| HACCP | boolean badge |
| ISO Cert | present/absent |
| Payment Terms | `suppliers.paymentTerms` |
| Linked Buyers | count from `suppliers.buyerIds` |
| Active Deals | count |
| Pipeline Value | sum of deal `expectedRevenue` |

---

### Tab C: Old Suppliers Report

**Business Question:** What's in our archive? Is there any supplier worth re-engaging? What did we lose and why?

#### KPI Cards

| Card | Value |
|------|-------|
| Total Old Suppliers | count |
| Countries | distinct country count |
| Products Represented | distinct product categories |
| Avg Days Active Before Archive | avg time from creation to archive |

#### Charts

- **Old Suppliers by Country** (Bar Chart)
- **Old Suppliers by Product Category** (Bar Chart) — What product lines have we lost coverage on?
- **Archival Timeline** (Line Chart) — When were suppliers archived? Spikes might indicate a business event.

#### Table: Old Supplier Archive Table

| Column | Source |
|--------|--------|
| Company | `old_suppliers.company` |
| Country | `old_suppliers.country` |
| Products | `old_suppliers.products` |
| Contact Person | `old_suppliers.contactPerson` |
| Email | `old_suppliers.email` |
| Date Archived | `old_suppliers.createdAt` (or updatedAt) |
| Payment Terms | `old_suppliers.paymentTerms` |
| Certifications | summary of available certs |

Re-engagement flag: if an old supplier has the same product categories as current active buyer demand, flag them with a "Re-engage?" indicator.

### Filters (shared across tabs)
- Country
- Product category (text search on products field)
- Date range (added)
- For Signed: vetting score range, deal stage, certification filters

### Export
- PDF: Tab-specific (export whichever tab is active)
- Excel: 3 sheets (New / Signed / Old) all in one workbook

---

## 3. Employees Report (`/reports/employees`)

### Business Purpose
Track individual employee contribution to the sourcing pipeline. Understand who is sourcing the most suppliers, how their sourced suppliers are progressing through the pipeline, and identify top performers and those who may need support. This is a management tool for accountability and recognition.

**Primary Data Link:**
- `sourcing_suppliers.createdById` → `users.id` (who sourced the supplier)
- `new_suppliers.convertedFromSourcingId` → tracks if a sourcing supplier became new
- `new_suppliers` also has `createdById` — who converted them
- `suppliers` (signed) also has `createdById`

This three-level chain allows computing: Employee → Sourced → Converted to New → Converted to Signed

### KPI Cards Row

| Card | Value |
|------|-------|
| Total Active Employees | count of non-admin users with designation |
| Total Sourcing Suppliers (All) | count in `sourcing_suppliers` |
| Sourcing → New Conversion Rate | (new suppliers with `convertedFromSourcingId`) / total sourcing × 100 |
| New → Signed Conversion Rate | (signed suppliers converted from new) / total new × 100 |
| End-to-End Conversion Rate | sourcing that became signed / total sourcing × 100 |
| Top Sourcer (Month) | employee with most sourcing suppliers added this month |

### Charts

**Row 1 — Volume:**
- **Sourcing Suppliers per Employee** (Bar Chart, sorted descending) — Who is adding the most prospects? Business use: workload distribution and individual KPI tracking.
- **Monthly Sourcing Activity by Employee** (Stacked Line or Grouped Bar, last 6 months) — Shows trend: is an employee improving or slowing down?

**Row 2 — Quality / Conversion:**
- **Conversion Rate per Employee** (Grouped Bar per employee: % Sourcing→New, % New→Signed) — Volume is meaningless without quality. A sourcer who adds 50 suppliers but converts none is less effective than one who adds 10 and converts 7.
- **Email Campaign Response Rate per Employee** (Bar Chart) — Of all sourcing suppliers an employee added, what % replied to outreach emails? Indicates quality of sourcing leads.

**Row 3 — Pipeline Status Breakdown:**
- **Per-Employee Supplier Status Breakdown** (Stacked Bar) — For each employee, how many of their sourced suppliers are at each status (pending / intro_sent / followup1 / followup2 / responded / converted)?
- **Country Distribution per Employee** (Heatmap or grouped bar) — Which countries does each employee source from? Identifies specialization or gaps.

### Employee Summary Cards

For each employee, render a card with:
- Name + Designation
- Avatar / initials
- Total Suppliers Sourced (all time)
- This Month count
- Conversion: X sourced → Y new → Z signed
- Email response rate
- Countries sourced from (tag list)
- Top 3 product categories sourced

Clicking an employee card expands or navigates to their detailed view.

### Detailed Table: Per-Employee Supplier Attribution

Filterable by employee. Shows every sourcing supplier attributed to a selected employee:

| Column | Source |
|--------|--------|
| Supplier Company | `sourcing_suppliers.company` |
| Country | `sourcing_suppliers.country` |
| Products | `sourcing_suppliers.products` |
| Current Status | `sourcing_suppliers.status` |
| Email Stage | from `SourcingEmailCampaign` |
| Intro Sent | date |
| Last Followup | date of last followup sent |
| Response Received | boolean + date |
| Converted to New | boolean (convertedFromSourcingId exists) |
| Converted to Signed | boolean (if exists in signed table) |
| Date Sourced | `sourcing_suppliers.createdAt` |
| Days in Pipeline | today − createdAt |

### Leaderboard Section

A ranked table of all employees by sourcing performance. Columns:
- Rank
- Employee Name
- Designation
- Total Sourced (all time)
- This Month
- Conversion Rate (sourcing → signed)
- Avg Days to Respond (of their leads)
- Countries Covered

### Filters
- Employee (dropdown multi-select)
- Date range (when sourcing supplier was added)
- Status (pending / intro_sent / responded / converted / not_converted)
- Country
- Product category

### Export
- PDF: KPI cards + all 4 charts + leaderboard table + full attribution table
- Excel: Sheet 1 — Leaderboard; Sheet 2 — Full attribution table (all employees); one sheet per employee

---

## Backend API Design

### New Endpoints (under `/api/analytics/`)

All endpoints require `reports` permission (read level). Accept standard query params: `startDate`, `endDate`.

#### Buyers Report
```
GET /api/analytics/buyers-report
Response: {
  kpis: { totalBuyers, activeBuyers, pendingBuyers, suspendedBuyers, 
          totalPipelineValue, countriesCount, highRiskCount, noDealCount, avgDealValue },
  statusBreakdown: [{ status, count }],
  byCountry: [{ country, count }],
  topByPipelineValue: [{ buyerName, company, expectedRevenue }],
  dealStageDistribution: [{ stage, count }],
  productCategoryDemand: [{ category, count }],
  riskDistribution: [{ rating, count }],
  acquisitionTrend: [{ month, count }],
  buyerTable: [{ ...full buyer row with deal metrics }],
  noDealBuyers: [{ ...buyer rows with no deals }],
  noSupplierLinkBuyers: [{ ...buyer rows with deals but no supplier links }]
}
```

#### Suppliers Report
```
GET /api/analytics/suppliers-report?tab=new|signed|old
Response for tab=new: {
  kpis: { total, formSubmitted, introSent, responded, avgDaysToRespond, countries },
  onboardingFunnel: [{ stage, count }],
  byCountry: [...],
  productCoverage: [...],
  timeInPipeline: [{ bucket, count }],
  monthlyTrend: [...],
  table: [{ ...new supplier row with email campaign data }]
}
Response for tab=signed: {
  kpis: { total, withActiveDeals, avgVettingScore, avgMarginPercent, countries, haccpCount },
  dealStageDistribution: [...],
  topByDealValue: [...],
  vettingScoreDistribution: [...],
  marginDistribution: [...],
  certificationCoverage: [{ cert, count, percentage }],
  byCountry: [...],
  paymentTermsBreakdown: [...],
  table: [{ ...signed supplier row with deal and cert metrics }]
}
Response for tab=old: {
  kpis: { total, countries, productCategories, avgDaysActive },
  byCountry: [...],
  byProductCategory: [...],
  archivalTimeline: [...],
  table: [{ ...old supplier row }]
}
```

#### Employees Report
```
GET /api/analytics/employees-report
Response: {
  kpis: { activeEmployees, totalSourcing, sourcingToNewRate, newToSignedRate, endToEndRate, topSourcerId },
  perEmployee: [{
    userId, fullName, designation,
    totalSourced, thisMonth,
    convertedToNew, convertedToSigned, conversionRate,
    emailResponseRate,
    countries: [...],
    topProducts: [...],
    monthlyTrend: [...],
    statusBreakdown: [{ status, count }]
  }],
  leaderboard: [{ rank, userId, fullName, designation, totalSourced, thisMonth, conversionRate, avgDaysToRespond, countriesCount }],
  attributionTable: [{
    employeeName, supplierCompany, country, products, status, 
    emailStage, introSentAt, lastFollowupAt, responseReceivedAt,
    convertedToNew, convertedToSigned, createdAt, daysInPipeline
  }]
}
```

### Performance Considerations
- All analytics endpoints should run efficient Prisma queries using `groupBy`, aggregations, and `count`.
- For the Employees Report attribution table, use pagination (`page`, `limit` params) — this can be a large dataset.
- Cache-friendly: responses are read-only; consider adding cache headers (5-min TTL) or in-memory cache for the aggregated stats.
- Export endpoints mirror the same queries but format output for PDF/Excel instead of JSON.

---

## Frontend Architecture

### File Structure

```
frontend/src/pages/reports/
├── ReportsBuyersPage.tsx          ← Buyers Report
├── ReportsSuppliersPage.tsx       ← Suppliers Report (tabbed)
├── ReportsEmployeesPage.tsx       ← Employees Report

frontend/src/components/reports/
├── KpiCard.tsx                    ← Reusable KPI stat card (value + label + subtext)
├── BuyerStatusChart.tsx           ← Donut chart for buyer status
├── BuyersByCountryChart.tsx       ← Bar chart
├── TopBuyersByValueChart.tsx      ← Horizontal bar
├── DealStageDistributionChart.tsx ← Stacked bar
├── ProductDemandChart.tsx         ← Horizontal bar
├── RiskRatingChart.tsx            ← Pie chart
├── AcquisitionTrendChart.tsx      ← Line chart
├── OnboardingFunnelChart.tsx      ← Funnel/waterfall
├── CertificationCoverageChart.tsx ← Grouped bar or radar
├── PerEmployeeVolumeChart.tsx     ← Bar chart
├── ConversionRateChart.tsx        ← Grouped bar
├── EmployeeStatusBreakdownChart.tsx ← Stacked bar
├── EmployeeCard.tsx               ← Per-employee summary card
├── ReportsFilterBar.tsx           ← Shared date/filter controls
└── ExportButton.tsx               ← PDF/Excel trigger
```

### Shared KpiCard Component

```tsx
<KpiCard
  label="Total Buyers"
  value={120}
  sub="94 Active · 18 Pending · 8 Suspended"
  trend={+12}          // optional: % change from last period
  icon={<Users />}
  color="blue"
/>
```

### Chart Library
Use **Recharts** (already in dependencies). Key components:
- `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend` — for bar charts
- `PieChart`, `Pie`, `Cell` — for donut/pie charts
- `LineChart`, `Line` — for trend charts
- `FunnelChart` (or custom implementation using Bar) — for onboarding funnel
- `ResponsiveContainer` — wraps all charts for responsive sizing

### State Management
Use TanStack React Query (`useQuery`) for data fetching — consistent with existing pages:
```ts
const { data, isLoading } = useQuery({
  queryKey: ['analytics', 'buyers-report', filters],
  queryFn: () => api.get('/analytics/buyers-report', { params: filters })
})
```

---

## UI / UX Design Guidelines

### Page Layout Template (all 3 reports):
```
[Page Title]                                        [Export PDF] [Export Excel]
[Filter Bar: Date Range | Country | Status | ...]

[KPI Cards Row — 4-6 cards in a grid]

[Charts Row 1 — 2 charts side by side]
[Charts Row 2 — 2 charts side by side]
[Charts Row 3 — 1 wide chart or 2 more]

[Data Table with search + pagination]
[Secondary Table (if applicable)]
```

### Design System Consistency
- Use existing `shadcn/ui` components: `Card`, `Badge`, `Table`, `Tabs`, `Select`, `DatePicker`
- KPI cards styled like dashboard stat cards
- Color palette: match existing badge colors (green=active, yellow=pending, red=suspended/high-risk)
- Chart colors: use a consistent 6-color palette across all reports (no random colors)
- Loading states: use existing skeleton patterns
- Empty states: show a descriptive message when no data matches filters

### Responsive Behavior
- KPI cards: 2-col on mobile, 3-col on tablet, 4-6 col on desktop
- Charts: single column on mobile, 2-col on desktop (ResponsiveContainer handles width)
- Tables: horizontal scroll on mobile, full width on desktop

---

## Permissions & Access Control

No new permissions needed — all 3 reports are gated behind the existing `reports` permission:
- Read level: can view all 3 reports
- The existing `isAdmin` bypass applies
- Employees Report is additional-restricted to admin or users with `analytics` permission (management-sensitive data)

Update `UserPermission` enum documentation to note that `analytics` now also covers the Employees Report.

---

## Implementation Order

### Phase 1 — Backend APIs (2-3 days)
1. Create `/backend/src/controllers/analytics.controller.ts`
2. Implement `getBuyersReport()` function with all aggregations
3. Implement `getSuppliersReport()` function (new/signed/old tabs)
4. Implement `getEmployeesReport()` function with attribution chain
5. Add PDF/Excel export methods for each report (extend existing PDF/Excel services)
6. Register routes in `/backend/src/index.ts` under `/api/analytics/`
7. Add proper permission middleware

### Phase 2 — Sidebar & Routing (0.5 days)
1. Update `AppLayout.tsx` to add Reports as collapsible section
2. Add routes in `App.tsx` / router config for `/reports/buyers`, `/reports/suppliers`, `/reports/employees`
3. Update the existing `/reports` link to be the first sub-item ("Report Tracker")

### Phase 3 — Shared Components (1 day)
1. Build `KpiCard.tsx` component
2. Build `ReportsFilterBar.tsx` with date range and common filter controls
3. Build `ExportButton.tsx` component
4. Set up React Query hooks for each report endpoint

### Phase 4 — Buyers Report Page (1-2 days)
1. KPI cards section
2. 6-7 charts (using Recharts)
3. Buyer Performance Table with sorting and search
4. No-Deal Buyers secondary table
5. Export functionality

### Phase 5 — Suppliers Report Page (2 days)
1. Tabbed layout (New / Signed / Old)
2. Per-tab KPI cards
3. Per-tab charts
4. Per-tab data tables
5. Export (tab-specific)

### Phase 6 — Employees Report Page (2 days)
1. Overall KPI cards
2. 4 charts
3. Employee Summary Cards grid
4. Detailed Attribution Table with employee filter
5. Leaderboard Table
6. Export (leaderboard + full attribution)

### Phase 7 — QA & Polish (1 day)
1. Test all endpoints with real data
2. Verify permissions restrict correctly
3. Verify exports match displayed data
4. Verify responsive layout on smaller viewports
5. Verify loading/error/empty states

**Total Estimate: ~10 working days**

---

## Data Edge Cases & Notes

1. **Buyer-Deal linkage** is by name string match (`deals.buyer = buyers.name`) — queries must handle case sensitivity and trimming. Use `icontains` equivalent in Prisma.

2. **Supplier attribution** across 3 tables: some "signed" suppliers may have been directly added (not through sourcing pipeline). The `convertedFromSourcingId` chain is the source of truth for end-to-end tracking.

3. **Employee report** only shows employees with the `sourcing_suppliers` records linked via `createdById`. Employees who only manage buyers or deals (not sourcing) will appear in the leaderboard with 0 sourcing count — show them anyway for completeness.

4. **Old suppliers** have no `dealStage` or campaign data — keep their report tab simpler and focus on archive value.

5. **Date range filters** should default to "All Time" on initial load (not current month), since management will want the full picture first. Offer quick presets: This Month, Last 3 Months, Last 6 Months, This Year, All Time.

6. **Export PDF for charts** — use `html2canvas` or `recharts` SVG export to capture charts as images before embedding in pdfkit. Add `html2canvas` to frontend dependencies.

7. **Employees Report — admin only for salary-adjacent views**: do not show salary data in this report (that's in Payroll), but designation, sourcing counts, and conversion rates are fine for team leads to see.

---

## Future Enhancements (Not in Scope Now)

- **Scheduled Report Emails**: Weekly PDF emailed to admin summarizing all 3 reports
- **Target Setting**: Allow admin to set monthly targets per employee (e.g., 10 sourcing suppliers/month) and show progress vs target in Employees Report
- **Buyer Health Score**: Composite score per buyer based on deal stage, risk, engagement recency
- **Supplier Scorecard**: Downloadable per-supplier scorecard PDF (vetting + deals + certifications)
- **Comparative Period**: Show current period vs previous period delta on all KPI cards
- **Deal Win Rate**: Track how many deals per buyer/supplier reached "Orders confirmed" stage vs total deals started
