import prisma from "../config/db.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function padZ(n: number) { return String(n).padStart(2, "0"); }

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReportType = "daily" | "weekly" | "monthly";

export interface OutreachEntry {
  name: string;
  introSent: number;
  fu1Sent: number;
  fu2Sent: number;
  fu3Sent: number;
  totalEmails: number;
  signedCount: number;
}

export interface SupplierAnalytics {
  totalAdded: number;
  introEmailsSent: number;
  fu1Sent: number;
  fu2Sent: number;
  fu3Sent: number;
  signedCount: number;
  newOnboardingCount: number;
  inSourcingCount: number;
  teamOutreach: OutreachEntry[];
  totalSignedByTeam: number;
}

export interface BuyerAnalytics {
  totalAdded: number;
  introEmailsSent: number;
  fu1Sent: number;
  fu2Sent: number;
  fu3Sent: number;
  activeCount: number;
  sourcingCount: number;
  teamOutreach: OutreachEntry[];
  totalSignedByTeam: number;
}

export interface DealStageEntry {
  stage: string;
  count: number;
  revenue: number;
}

export interface DealAnalytics {
  totalActive: number;
  newInPeriod: number;
  stale: number;
  byStage: DealStageEntry[];
  totalRevenue: number;
}

export interface TaskEmployeeEntry {
  name: string;
  pending: number;
  completed: number;
  closed: number;
}

export interface TaskAnalytics {
  totalPending: number;
  totalCompleted: number;
  createdInPeriod: number;
  completedInPeriod: number;
  byEmployee: TaskEmployeeEntry[];
}

export interface AttendanceEmployeeEntry {
  name: string;
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  weeklyOff: number;
}

export interface AttendanceAnalytics {
  totalPresent: number;
  totalAbsent: number;
  totalLeave: number;
  totalHalfDay: number;
  totalWeeklyOff: number;
  totalEmployees: number;
  workingDays: number;
  byEmployee: AttendanceEmployeeEntry[];
}

export interface CRMReportData {
  reportType: ReportType;
  periodLabel: string;
  shortPeriodLabel: string;
  dayBadge: string;
  isoDate: string;
  generatedAt: string;
  suppliers: SupplierAnalytics;
  buyers: BuyerAnalytics;
  deals: DealAnalytics;
  tasks: TaskAnalytics;
  attendance?: AttendanceAnalytics;
}

interface DateRange {
  start: Date;
  end: Date;
  startDateOnly: Date;
  endDateOnly: Date;
  periodLabel: string;
  shortPeriodLabel: string;
  dayBadge: string;
  isoDate: string;
}

// ── Date range helpers ────────────────────────────────────────────────────────

export function getDailyDateRange(): DateRange {
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
  const y = nowIST.getUTCFullYear(), m = nowIST.getUTCMonth(), d = nowIST.getUTCDate();

  const yesterday = new Date(Date.UTC(y, m, d - 1));
  const yy = yesterday.getUTCFullYear(), ym = yesterday.getUTCMonth(), yd = yesterday.getUTCDate();

  const start = new Date(Date.UTC(yy, ym, yd) - IST_OFFSET_MS);
  const end   = new Date(Date.UTC(yy, ym, yd, 23, 59, 59, 999) - IST_OFFSET_MS);

  return {
    start, end,
    startDateOnly: new Date(Date.UTC(yy, ym, yd)),
    endDateOnly:   new Date(Date.UTC(yy, ym, yd)),
    periodLabel:      `${DAYS[yesterday.getUTCDay()]}, ${padZ(yd)} ${MONTHS[ym]} ${yy}`,
    shortPeriodLabel: `${padZ(yd)}-${padZ(ym + 1)}-${yy}`,
    dayBadge: DAYS[yesterday.getUTCDay()].toUpperCase(),
    isoDate:  `${yy}-${padZ(ym + 1)}-${padZ(yd)}`,
  };
}

export function getWeeklyDateRange(): DateRange {
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
  const y = nowIST.getUTCFullYear(), m = nowIST.getUTCMonth(), d = nowIST.getUTCDate();
  const dow = nowIST.getUTCDay();

  const daysToLastSunday = dow === 0 ? 7 : dow;
  const prevSunday = new Date(Date.UTC(y, m, d - daysToLastSunday));
  const prevMonday = new Date(Date.UTC(
    prevSunday.getUTCFullYear(), prevSunday.getUTCMonth(), prevSunday.getUTCDate() - 6,
  ));

  const sy = prevMonday.getUTCFullYear(), sm = prevMonday.getUTCMonth(), sd = prevMonday.getUTCDate();
  const ey = prevSunday.getUTCFullYear(), em = prevSunday.getUTCMonth(), ed = prevSunday.getUTCDate();

  const start = new Date(Date.UTC(sy, sm, sd) - IST_OFFSET_MS);
  const end   = new Date(Date.UTC(ey, em, ed, 23, 59, 59, 999) - IST_OFFSET_MS);

  const periodLabel = sm === em
    ? `${padZ(sd)}–${padZ(ed)} ${MONTHS[sm]} ${sy}`
    : `${padZ(sd)} ${SHORT_MONTHS[sm]} – ${padZ(ed)} ${SHORT_MONTHS[em]} ${ey}`;

  return {
    start, end,
    startDateOnly: new Date(Date.UTC(sy, sm, sd)),
    endDateOnly:   new Date(Date.UTC(ey, em, ed)),
    periodLabel,
    shortPeriodLabel: `Week-${padZ(sd)}-${padZ(sm + 1)}-${sy}`,
    dayBadge: "WEEKLY",
    isoDate:  `${sy}-${padZ(sm + 1)}-${padZ(sd)}_to_${ey}-${padZ(em + 1)}-${padZ(ed)}`,
  };
}

export function getMonthlyDateRange(): DateRange {
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
  const y = nowIST.getUTCFullYear(), m = nowIST.getUTCMonth();

  const py = m === 0 ? y - 1 : y;
  const pm = m === 0 ? 11 : m - 1;
  const lastDay = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();

  const start = new Date(Date.UTC(py, pm, 1) - IST_OFFSET_MS);
  const end   = new Date(Date.UTC(py, pm, lastDay, 23, 59, 59, 999) - IST_OFFSET_MS);

  return {
    start, end,
    startDateOnly: new Date(Date.UTC(py, pm, 1)),
    endDateOnly:   new Date(Date.UTC(py, pm, lastDay)),
    periodLabel:      `${MONTHS[pm]} ${py}`,
    shortPeriodLabel: `${SHORT_MONTHS[pm]}-${py}`,
    dayBadge: "MONTHLY",
    isoDate:  `${py}-${padZ(pm + 1)}`,
  };
}

// ── Email helpers ─────────────────────────────────────────────────────────────

type Campaign = {
  introEmailSentAt: Date;
  followup1SentAt: Date | null;
  followup2SentAt: Date | null;
  followup3SentAt: Date | null;
};

function countEmailsByType(campaigns: Campaign[], start: Date, end: Date) {
  let intros = 0, fu1 = 0, fu2 = 0, fu3 = 0;
  for (const c of campaigns) {
    if (c.introEmailSentAt >= start && c.introEmailSentAt <= end) intros++;
    if (c.followup1SentAt && c.followup1SentAt >= start && c.followup1SentAt <= end) fu1++;
    if (c.followup2SentAt && c.followup2SentAt >= start && c.followup2SentAt <= end) fu2++;
    if (c.followup3SentAt && c.followup3SentAt >= start && c.followup3SentAt <= end) fu3++;
  }
  return { intros, fu1, fu2, fu3 };
}

// Adds email counts from one campaign to the per-userId map
type EmailCounts = { intro: number; fu1: number; fu2: number; fu3: number };

function addEmailToMap(
  userId: string | null | undefined,
  c: Campaign,
  map: Map<string, EmailCounts>,
  start: Date, end: Date,
) {
  if (!userId) return;
  const e = map.get(userId) ?? { intro: 0, fu1: 0, fu2: 0, fu3: 0 };
  if (c.introEmailSentAt >= start && c.introEmailSentAt <= end) e.intro++;
  if (c.followup1SentAt && c.followup1SentAt >= start && c.followup1SentAt <= end) e.fu1++;
  if (c.followup2SentAt && c.followup2SentAt >= start && c.followup2SentAt <= end) e.fu2++;
  if (c.followup3SentAt && c.followup3SentAt >= start && c.followup3SentAt <= end) e.fu3++;
  map.set(userId, e);
}

const EMAIL_DATE_FILTER = (start: Date, end: Date) => ({
  where: {
    OR: [
      { introEmailSentAt: { gte: start, lte: end } },
      { followup1SentAt:  { gte: start, lte: end } },
      { followup2SentAt:  { gte: start, lte: end } },
      { followup3SentAt:  { gte: start, lte: end } },
    ],
  },
});

const EXCLUDED_TASK_NAMES = new Set(["fahad", "test", "parth singh", "n/a", "na"]);

const DEAL_STAGE_ORDER = [
  "Communication",
  "Price Approval by Buyer",
  "Negotiation with Buyer",
  "No Ongoing Deal",
  "Sampling",
  "Orders Confirmed from Buyer",
  "Timeline to be Established from Supplier",
  "Order Shipped & Shipping Docs Received",
];

// ── Core data collector ───────────────────────────────────────────────────────

export async function collectReportData(range: DateRange, reportType: ReportType): Promise<CRMReportData> {
  const { start, end, startDateOnly, endDateOnly } = range;

  const generatedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true },
  });

  // ── 1. Suppliers added in period ──────────────────────────────────────────
  const [signedSuppliers, newSups, sourcingSups] = await Promise.all([
    prisma.supplier.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdBy: true },
    }),
    prisma.newSupplier.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdBy: true },
    }),
    prisma.sourcingSupplier.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdBy: true },
    }),
  ]);

  // Supplier email campaigns — with creator attribution via the parent supplier
  const [secRaw, nsecRaw, soecRaw] = await Promise.all([
    prisma.supplierEmailCampaign.findMany({
      ...EMAIL_DATE_FILTER(start, end),
      select: {
        introEmailSentAt: true, followup1SentAt: true, followup2SentAt: true, followup3SentAt: true,
        supplier: { select: { createdBy: true } },
      },
    }),
    prisma.newSupplierEmailCampaign.findMany({
      ...EMAIL_DATE_FILTER(start, end),
      select: {
        introEmailSentAt: true, followup1SentAt: true, followup2SentAt: true, followup3SentAt: true,
        newSupplier: { select: { createdBy: true } },
      },
    }),
    prisma.sourcingEmailCampaign.findMany({
      ...EMAIL_DATE_FILTER(start, end),
      select: {
        introEmailSentAt: true, followup1SentAt: true, followup2SentAt: true, followup3SentAt: true,
        sourcingSupplier: { select: { createdBy: true } },
      },
    }),
  ]);

  // Aggregate supplier email totals (for KPI cards)
  const s1 = countEmailsByType(secRaw,  start, end);
  const s2 = countEmailsByType(nsecRaw, start, end);
  const s3 = countEmailsByType(soecRaw, start, end);

  // Per-user supplier email map
  const supplierEmailByUser = new Map<string, EmailCounts>();
  for (const c of secRaw)  addEmailToMap(c.supplier.createdBy,         c, supplierEmailByUser, start, end);
  for (const c of nsecRaw) addEmailToMap(c.newSupplier.createdBy,      c, supplierEmailByUser, start, end);
  for (const c of soecRaw) addEmailToMap(c.sourcingSupplier.createdBy, c, supplierEmailByUser, start, end);

  // Supplier dept employees — users who have created sourcing supplier records
  const supplierDeptUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { none: { role: "admin" } },
      sourcingSuppliers: { some: {} },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  // Signed suppliers created in period, per employee
  const signedByUser = new Map<string, number>();
  for (const s of signedSuppliers) {
    if (s.createdBy) signedByUser.set(s.createdBy, (signedByUser.get(s.createdBy) ?? 0) + 1);
  }

  const supplierOutreach: OutreachEntry[] = supplierDeptUsers.map((u) => {
    const emails = supplierEmailByUser.get(u.id) ?? { intro: 0, fu1: 0, fu2: 0, fu3: 0 };
    return {
      name:        u.fullName,
      introSent:   emails.intro,
      fu1Sent:     emails.fu1,
      fu2Sent:     emails.fu2,
      fu3Sent:     emails.fu3,
      totalEmails: emails.intro + emails.fu1 + emails.fu2 + emails.fu3,
      signedCount: signedByUser.get(u.id) ?? 0,
    };
  });

  // ── 2. Buyers added in period ─────────────────────────────────────────────
  const [activeBuyers, sourcingBuyers] = await Promise.all([
    prisma.buyer.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdBy: true },
    }),
    prisma.sourcingBuyer.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdBy: true },
    }),
  ]);

  const sbecRaw = await prisma.sourcingBuyerEmailCampaign.findMany({
    ...EMAIL_DATE_FILTER(start, end),
    select: {
      introEmailSentAt: true, followup1SentAt: true, followup2SentAt: true, followup3SentAt: true,
      sourcingBuyer: { select: { createdBy: true } },
    },
  });

  const b1 = countEmailsByType(sbecRaw, start, end);

  // Per-user buyer email map
  const buyerEmailByUser = new Map<string, EmailCounts>();
  for (const c of sbecRaw) addEmailToMap(c.sourcingBuyer.createdBy, c, buyerEmailByUser, start, end);

  // Buyer dept employees — users who have created sourcing buyer records
  const buyerDeptUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { none: { role: "admin" } },
      sourcingBuyers: { some: {} },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  // Active buyers created in period, per employee
  const buyerSignedByUser = new Map<string, number>();
  for (const b of activeBuyers) {
    if (b.createdBy) buyerSignedByUser.set(b.createdBy, (buyerSignedByUser.get(b.createdBy) ?? 0) + 1);
  }

  const buyerOutreach: OutreachEntry[] = buyerDeptUsers.map((u) => {
    const emails = buyerEmailByUser.get(u.id) ?? { intro: 0, fu1: 0, fu2: 0, fu3: 0 };
    return {
      name:        u.fullName,
      introSent:   emails.intro,
      fu1Sent:     emails.fu1,
      fu2Sent:     emails.fu2,
      fu3Sent:     emails.fu3,
      totalEmails: emails.intro + emails.fu1 + emails.fu2 + emails.fu3,
      signedCount: buyerSignedByUser.get(u.id) ?? 0,
    };
  });

  // ── 3. Deal pipeline (snapshot) ───────────────────────────────────────────
  const allDeals = await prisma.deal.findMany({
    select: { stage: true, expectedRevenue: true, updatedAt: true, createdAt: true },
  });

  const dealStageMap = new Map<string, { count: number; revenue: number }>();
  for (const deal of allDeals) {
    const ex = dealStageMap.get(deal.stage) ?? { count: 0, revenue: 0 };
    ex.count++;
    ex.revenue += deal.expectedRevenue ?? 0;
    dealStageMap.set(deal.stage, ex);
  }

  const dealsByStage: DealStageEntry[] = Array.from(dealStageMap.entries())
    .filter(([, v]) => v.count > 0)
    .sort(([a], [b]) => {
      const ai = DEAL_STAGE_ORDER.indexOf(a);
      const bi = DEAL_STAGE_ORDER.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    })
    .map(([stage, s]) => ({ stage, count: s.count, revenue: s.revenue }));

  const newInPeriod = allDeals.filter((d) => d.createdAt >= start && d.createdAt <= end).length;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stale = allDeals.filter(
    (d) => !["Order Shipped & Shipping Docs Received", "Closed"].includes(d.stage) && d.updatedAt < sevenDaysAgo,
  ).length;
  const totalRevenue = allDeals.reduce((s, d) => s + (d.expectedRevenue ?? 0), 0);

  // ── 4. Tasks ──────────────────────────────────────────────────────────────
  // KPI totals: all-time snapshot for Total Pending / Total Completed
  const allTasksSnapshot = await prisma.dailyTask.findMany({
    select: { owner: true, status: true },
  });

  let totalPending = 0, totalCompleted = 0;
  for (const t of allTasksSnapshot) {
    if (EXCLUDED_TASK_NAMES.has((t.owner ?? "").toLowerCase().trim())) continue;
    const s = t.status.toLowerCase();
    if (s === "completed") totalCompleted++;
    else if (s !== "closed") totalPending++;
  }

  // Period-specific tasks for KPI "created" / "completed in period"
  const allPeriodTasks = await prisma.dailyTask.findMany({
    where: {
      OR: [
        { createdAt: { gte: start, lte: end } },
        { updatedAt: { gte: start, lte: end } },
      ],
    },
    select: { owner: true, status: true, createdAt: true, updatedAt: true },
  });

  let createdInPeriod = 0, completedInPeriod = 0;
  // Table: period-specific breakdown per employee (Pending | Completed | Closed)
  type TaskCounts = { pending: number; completed: number; closed: number };
  const taskTableMap = new Map<string, TaskCounts>();

  for (const task of allPeriodTasks) {
    const owner = task.owner ?? "Unassigned";
    if (EXCLUDED_TASK_NAMES.has(owner.toLowerCase().trim())) continue;

    const statusLower = task.status.toLowerCase().trim();
    const e = taskTableMap.get(owner) ?? { pending: 0, completed: 0, closed: 0 };

    if (task.createdAt >= start && task.createdAt <= end) createdInPeriod++;

    if (statusLower === "closed" && task.updatedAt >= start && task.updatedAt <= end) {
      e.closed++;
    } else if (statusLower === "completed" && task.updatedAt >= start && task.updatedAt <= end) {
      e.completed++;
      completedInPeriod++;
    } else if (!["completed", "closed"].includes(statusLower) && task.createdAt >= start && task.createdAt <= end) {
      // pending / not-started / in-progress created in period
      e.pending++;
    }

    taskTableMap.set(owner, e);
  }

  const taskByEmployee: TaskEmployeeEntry[] = Array.from(taskTableMap.entries())
    .filter(([, s]) => s.pending + s.completed + s.closed > 0)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => (b.pending + b.completed + b.closed) - (a.pending + a.completed + a.closed));

  // ── 5. Attendance (weekly / monthly only) ─────────────────────────────────
  let attendance: AttendanceAnalytics | undefined;

  if (reportType !== "daily") {
    const records = await prisma.attendance.findMany({
      where: { date: { gte: startDateOnly, lte: endDateOnly } },
      include: { user: { select: { fullName: true } } },
    });

    type EmpAtt = { present: number; absent: number; leave: number; halfDay: number; weeklyOff: number };
    const attMap = new Map<string, EmpAtt>();

    for (const a of records) {
      const name = a.user.fullName;
      const e = attMap.get(name) ?? { present: 0, absent: 0, leave: 0, halfDay: 0, weeklyOff: 0 };
      if (a.status === "Present")   e.present++;
      else if (a.status === "Absent")    e.absent++;
      else if (a.status === "Leave")     e.leave++;
      else if (a.status === "HalfDay")   e.halfDay++;
      else if (a.status === "WeeklyOff") e.weeklyOff++;
      attMap.set(name, e);
    }

    const byEmployee: AttendanceEmployeeEntry[] = Array.from(attMap.entries())
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const totals = byEmployee.reduce(
      (acc, e) => ({
        present:   acc.present + e.present,
        absent:    acc.absent + e.absent,
        leave:     acc.leave + e.leave,
        halfDay:   acc.halfDay + e.halfDay,
        weeklyOff: acc.weeklyOff + e.weeklyOff,
      }),
      { present: 0, absent: 0, leave: 0, halfDay: 0, weeklyOff: 0 },
    );

    let workingDays = 0;
    const cur = new Date(startDateOnly);
    while (cur <= endDateOnly) {
      const dow = cur.getUTCDay();
      if (dow >= 1 && dow <= 5) workingDays++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    attendance = {
      totalPresent:    totals.present,
      totalAbsent:     totals.absent,
      totalLeave:      totals.leave,
      totalHalfDay:    totals.halfDay,
      totalWeeklyOff:  totals.weeklyOff,
      totalEmployees:  allUsers.length,
      workingDays,
      byEmployee,
    };
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  return {
    reportType,
    periodLabel:      range.periodLabel,
    shortPeriodLabel: range.shortPeriodLabel,
    dayBadge:         range.dayBadge,
    isoDate:          range.isoDate,
    generatedAt,

    suppliers: {
      totalAdded:         signedSuppliers.length + newSups.length + sourcingSups.length,
      introEmailsSent:    s1.intros + s2.intros + s3.intros,
      fu1Sent:            s1.fu1 + s2.fu1 + s3.fu1,
      fu2Sent:            s1.fu2 + s2.fu2 + s3.fu2,
      fu3Sent:            s1.fu3 + s2.fu3 + s3.fu3,
      signedCount:        signedSuppliers.length,
      newOnboardingCount: newSups.length,
      inSourcingCount:    sourcingSups.length,
      teamOutreach:       supplierOutreach,
      totalSignedByTeam:  supplierOutreach.reduce((s, e) => s + e.signedCount, 0),
    },

    buyers: {
      totalAdded:      activeBuyers.length + sourcingBuyers.length,
      introEmailsSent: b1.intros,
      fu1Sent:         b1.fu1,
      fu2Sent:         b1.fu2,
      fu3Sent:         b1.fu3,
      activeCount:     activeBuyers.length,
      sourcingCount:   sourcingBuyers.length,
      teamOutreach:    buyerOutreach,
      totalSignedByTeam: buyerOutreach.reduce((s, e) => s + e.signedCount, 0),
    },

    deals: {
      totalActive: allDeals.length,
      newInPeriod,
      stale,
      byStage:      dealsByStage,
      totalRevenue,
    },

    tasks: {
      totalPending,
      totalCompleted,
      createdInPeriod,
      completedInPeriod,
      byEmployee: taskByEmployee,
    },

    attendance,
  };
}

// ── Public entry points ───────────────────────────────────────────────────────

export async function generateDailyReport():   Promise<CRMReportData> {
  return collectReportData(getDailyDateRange(),   "daily");
}

export async function generateWeeklyReport():  Promise<CRMReportData> {
  return collectReportData(getWeeklyDateRange(),  "weekly");
}

export async function generateMonthlyReport(): Promise<CRMReportData> {
  return collectReportData(getMonthlyDateRange(), "monthly");
}
