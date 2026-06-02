import prisma from "../config/db.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getReportDateRange() {
  const now = new Date();
  const nowInIST = new Date(now.getTime() + IST_OFFSET_MS);

  // Yesterday in IST (UTC math handles month/year rollover correctly)
  const yesterday = new Date(
    Date.UTC(nowInIST.getUTCFullYear(), nowInIST.getUTCMonth(), nowInIST.getUTCDate() - 1)
  );

  const yy = yesterday.getUTCFullYear();
  const ym = yesterday.getUTCMonth();
  const yd = yesterday.getUTCDate();

  // DateTime boundaries for filtering (IST midnight → UTC)
  const start = new Date(Date.UTC(yy, ym, yd, 0, 0, 0, 0) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(yy, ym, yd, 23, 59, 59, 999) - IST_OFFSET_MS);

  // Pure date for @db.Date fields
  const dateOnly = new Date(Date.UTC(yy, ym, yd));

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return {
    start,
    end,
    dateOnly,
    label: `${DAYS[yesterday.getUTCDay()]}, ${String(yd).padStart(2, "0")} ${MONTHS[ym]} ${yy}`,
    shortLabel: `${String(yd).padStart(2, "0")}-${String(ym + 1).padStart(2, "0")}-${yy}`,
    isoDate: `${yy}-${String(ym + 1).padStart(2, "0")}-${String(yd).padStart(2, "0")}`,
    dayOfWeek: DAYS[yesterday.getUTCDay()],
  };
}

export interface SupplierEntry {
  name: string;
  signed: number;
  newSuppliers: number;
  sourcing: number;
  total: number;
}

export interface BuyerEntry {
  name: string;
  active: number;
  sourcing: number;
  total: number;
}

export interface DealStageEntry {
  stage: string;
  count: number;
  totalRevenue: number;
}

export interface TaskEntry {
  name: string;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface AttendanceEntry {
  name: string;
  status: string;
  hours?: string;
}

export interface DailyReportData {
  reportDate: string;
  shortDate: string;
  isoDate: string;
  dayOfWeek: string;
  generatedAt: string;
  // KPI summary
  totalSuppliersAdded: number;
  totalBuyersAdded: number;
  totalEmailsSent: number;
  totalResponsesReceived: number;
  totalRepliesSent: number;
  // Suppliers
  suppliers: {
    byEmployee: SupplierEntry[];
    totalSigned: number;
    totalNew: number;
    totalSourcing: number;
  };
  // Buyers
  buyers: {
    byEmployee: BuyerEntry[];
    totalActive: number;
    totalSourcing: number;
  };
  // Email
  emailActivity: {
    sentTotal: number;
    introsSent: number;
    followupsSent: number;
    responsesReceived: number;
    supplierResponses: number;
    buyerResponses: number;
    repliesSentByUs: number;
  };
  // Deals
  deals: {
    byStage: DealStageEntry[];
    newToday: number;
    atRisk: number;
    totalActivePipelineRevenue: number;
  };
  // Tasks
  tasks: {
    byEmployee: TaskEntry[];
    totalPending: number;
    totalInProgress: number;
    totalCompleted: number;
    totalOverdue: number;
    createdYesterday: number;
    completedYesterday: number;
  };
  // Attendance
  attendance: {
    present: number;
    absent: number;
    onLeave: number;
    halfDay: number;
    weeklyOff: number;
    total: number;
    details: AttendanceEntry[];
  };
  // Campaign health
  campaigns: {
    dueToday: number;
    totalActive: number;
    awaitingResponse: number;
  };
  pendingLeaves: number;
}

function countEmailsInRange(
  campaigns: {
    introEmailSentAt: Date;
    followup1SentAt: Date | null;
    followup2SentAt: Date | null;
    followup3SentAt: Date | null;
  }[],
  start: Date,
  end: Date
) {
  let intros = 0;
  let followups = 0;
  for (const c of campaigns) {
    if (c.introEmailSentAt >= start && c.introEmailSentAt <= end) intros++;
    if (c.followup1SentAt && c.followup1SentAt >= start && c.followup1SentAt <= end) followups++;
    if (c.followup2SentAt && c.followup2SentAt >= start && c.followup2SentAt <= end) followups++;
    if (c.followup3SentAt && c.followup3SentAt >= start && c.followup3SentAt <= end) followups++;
  }
  return { intros, followups };
}

const EMAIL_CAMPAIGN_SELECT = {
  select: {
    introEmailSentAt: true,
    followup1SentAt: true,
    followup2SentAt: true,
    followup3SentAt: true,
  },
} as const;

const EMAIL_DATE_FILTER = (start: Date, end: Date) => ({
  where: {
    OR: [
      { introEmailSentAt: { gte: start, lte: end } },
      { followup1SentAt: { gte: start, lte: end } },
      { followup2SentAt: { gte: start, lte: end } },
      { followup3SentAt: { gte: start, lte: end } },
    ],
  },
});

export async function generateDailyReport(): Promise<DailyReportData> {
  const { start, end, dateOnly, label, shortLabel, isoDate, dayOfWeek } = getReportDateRange();

  const generatedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // ── User map for name resolution ──────────────────────────────────────────
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true },
  });
  const userMap = new Map(allUsers.map((u) => [u.id, u.fullName]));
  const getName = (id: string | null | undefined) =>
    id ? (userMap.get(id) ?? `User(${id.slice(0, 8)})`) : "Unassigned";

  // ── 1. Suppliers added yesterday ──────────────────────────────────────────
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

  type SupplierCounts = { signed: number; new: number; sourcing: number };
  const supplierMap = new Map<string, SupplierCounts>();
  const addSup = (key: string, field: keyof SupplierCounts) => {
    const e = supplierMap.get(key) ?? { signed: 0, new: 0, sourcing: 0 };
    e[field]++;
    supplierMap.set(key, e);
  };
  signedSuppliers.forEach((s) => addSup(s.createdBy ?? "Unassigned", "signed"));
  newSups.forEach((s) => addSup(s.createdBy ?? "Unassigned", "new"));
  sourcingSups.forEach((s) => addSup(s.createdBy ?? "Unassigned", "sourcing"));

  const supplierByEmployee: SupplierEntry[] = Array.from(supplierMap.entries())
    .map(([id, stats]) => ({
      name: id === "Unassigned" ? "Unassigned" : getName(id),
      signed: stats.signed,
      newSuppliers: stats.new,
      sourcing: stats.sourcing,
      total: stats.signed + stats.new + stats.sourcing,
    }))
    .sort((a, b) => b.total - a.total);

  // ── 2. Buyers added yesterday ─────────────────────────────────────────────
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

  type BuyerCounts = { active: number; sourcing: number };
  const buyerMap = new Map<string, BuyerCounts>();
  const addBuyer = (key: string, field: keyof BuyerCounts) => {
    const e = buyerMap.get(key) ?? { active: 0, sourcing: 0 };
    e[field]++;
    buyerMap.set(key, e);
  };
  activeBuyers.forEach((b) => addBuyer(b.createdBy ?? "Unassigned", "active"));
  sourcingBuyers.forEach((b) => addBuyer(b.createdBy ?? "Unassigned", "sourcing"));

  const buyerByEmployee: BuyerEntry[] = Array.from(buyerMap.entries())
    .map(([id, stats]) => ({
      name: id === "Unassigned" ? "Unassigned" : getName(id),
      active: stats.active,
      sourcing: stats.sourcing,
      total: stats.active + stats.sourcing,
    }))
    .sort((a, b) => b.total - a.total);

  // ── 3. Email activity ─────────────────────────────────────────────────────
  const [sec, nsec, soec, sbec] = await Promise.all([
    prisma.supplierEmailCampaign.findMany({ ...EMAIL_DATE_FILTER(start, end), ...EMAIL_CAMPAIGN_SELECT }),
    prisma.newSupplierEmailCampaign.findMany({ ...EMAIL_DATE_FILTER(start, end), ...EMAIL_CAMPAIGN_SELECT }),
    prisma.sourcingEmailCampaign.findMany({ ...EMAIL_DATE_FILTER(start, end), ...EMAIL_CAMPAIGN_SELECT }),
    prisma.sourcingBuyerEmailCampaign.findMany({ ...EMAIL_DATE_FILTER(start, end), ...EMAIL_CAMPAIGN_SELECT }),
  ]);

  const e1 = countEmailsInRange(sec, start, end);
  const e2 = countEmailsInRange(nsec, start, end);
  const e3 = countEmailsInRange(soec, start, end);
  const e4 = countEmailsInRange(sbec, start, end);

  const introsSent = e1.intros + e2.intros + e3.intros + e4.intros;
  const followupsSent = e1.followups + e2.followups + e3.followups + e4.followups;
  const totalEmailsSent = introsSent + followupsSent;

  const [supplierRepliesIn, buyerRepliesIn, supplierRepliesOut, buyerRepliesOut] = await Promise.all([
    prisma.supplierEmailReply.count({ where: { direction: "received", receivedAt: { gte: start, lte: end } } }),
    prisma.buyerEmailReply.count({ where: { direction: "received", receivedAt: { gte: start, lte: end } } }),
    prisma.supplierEmailReply.count({ where: { direction: "sent", createdAt: { gte: start, lte: end } } }),
    prisma.buyerEmailReply.count({ where: { direction: "sent", createdAt: { gte: start, lte: end } } }),
  ]);

  // ── 4. Deal pipeline ──────────────────────────────────────────────────────
  const allDeals = await prisma.deal.findMany({
    select: { stage: true, expectedRevenue: true, updatedAt: true, createdAt: true },
  });

  const STAGE_ORDER = ["Communication", "Negotiation", "Agreement", "Delivery"];
  const dealStageMap = new Map<string, { count: number; revenue: number }>();
  STAGE_ORDER.forEach((s) => dealStageMap.set(s, { count: 0, revenue: 0 }));

  allDeals.forEach((deal) => {
    const stage = STAGE_ORDER.includes(deal.stage) ? deal.stage : deal.stage;
    const existing = dealStageMap.get(stage) ?? { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += deal.expectedRevenue ?? 0;
    dealStageMap.set(stage, existing);
  });

  const dealsByStage: DealStageEntry[] = Array.from(dealStageMap.entries())
    .map(([stage, stats]) => ({ stage, count: stats.count, totalRevenue: stats.revenue }))
    .filter((d) => d.count > 0);

  const newDealsToday = allDeals.filter((d) => d.createdAt >= start && d.createdAt <= end).length;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dealsAtRisk = allDeals.filter(
    (d) => !["Delivery", "Closed"].includes(d.stage) && d.updatedAt < sevenDaysAgo
  ).length;
  const totalActivePipelineRevenue = allDeals
    .filter((d) => d.stage !== "Closed")
    .reduce((sum, d) => sum + (d.expectedRevenue ?? 0), 0);

  // ── 5. Tasks ──────────────────────────────────────────────────────────────
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const allTasks = await prisma.dailyTask.findMany({
    select: { owner: true, status: true, deadline: true, updatedAt: true, createdAt: true },
  });

  type TaskCounts = { pending: number; inProgress: number; completed: number; overdue: number };
  const taskMap = new Map<string, TaskCounts>();
  let createdYesterday = 0;
  let completedYesterday = 0;

  allTasks.forEach((task) => {
    const owner = task.owner ?? "Unassigned";
    const e = taskMap.get(owner) ?? { pending: 0, inProgress: 0, completed: 0, overdue: 0 };
    const statusLower = task.status.toLowerCase();
    const isDone = statusLower === "completed" || statusLower === "closed";
    const isOverdue =
      !isDone && task.deadline != null && task.deadline < todayMidnight;

    if (task.createdAt >= start && task.createdAt <= end) createdYesterday++;
    if (isDone && task.updatedAt >= start && task.updatedAt <= end) completedYesterday++;

    if (isDone) e.completed++;
    else if (isOverdue) e.overdue++;
    else if (statusLower === "in progress") e.inProgress++;
    else e.pending++;

    taskMap.set(owner, e);
  });

  const taskByEmployee: TaskEntry[] = Array.from(taskMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.pending + b.overdue - (a.pending + a.overdue));

  // ── 6. Attendance ─────────────────────────────────────────────────────────
  const attendanceRecords = await prisma.attendance.findMany({
    where: { date: dateOnly },
    include: { user: { select: { fullName: true } } },
  });

  const attendanceSummary = {
    present: 0,
    absent: 0,
    onLeave: 0,
    halfDay: 0,
    weeklyOff: 0,
    total: allUsers.length,
    details: [] as AttendanceEntry[],
  };

  attendanceRecords.forEach((a) => {
    const hours =
      a.realTimeMinutes > 0
        ? `${Math.floor(a.realTimeMinutes / 60)}h ${a.realTimeMinutes % 60}m`
        : undefined;
    attendanceSummary.details.push({ name: a.user.fullName, status: a.status, hours });
    if (a.status === "Present") attendanceSummary.present++;
    else if (a.status === "Absent") attendanceSummary.absent++;
    else if (a.status === "Leave") attendanceSummary.onLeave++;
    else if (a.status === "HalfDay") attendanceSummary.halfDay++;
    else if (a.status === "WeeklyOff") attendanceSummary.weeklyOff++;
  });

  attendanceSummary.details.sort((a, b) => a.name.localeCompare(b.name));

  // ── 7. Campaign health ────────────────────────────────────────────────────
  const [totalActive, dueToday, awaitingResponse] = await Promise.all([
    prisma.sourcingEmailCampaign.count({ where: { status: "active" } }),
    prisma.sourcingEmailCampaign.count({
      where: { status: "active", nextFollowupDue: { lte: new Date() } },
    }),
    prisma.sourcingEmailCampaign.count({
      where: { status: "active", responseReceivedAt: null, nextFollowupDue: null },
    }),
  ]);

  // ── 8. Pending leave approvals ────────────────────────────────────────────
  const pendingLeaves = await prisma.leave.count({ where: { status: "pending" } });

  // ── Assemble ──────────────────────────────────────────────────────────────
  return {
    reportDate: label,
    shortDate: shortLabel,
    isoDate,
    dayOfWeek,
    generatedAt,
    totalSuppliersAdded: signedSuppliers.length + newSups.length + sourcingSups.length,
    totalBuyersAdded: activeBuyers.length + sourcingBuyers.length,
    totalEmailsSent,
    totalResponsesReceived: supplierRepliesIn + buyerRepliesIn,
    totalRepliesSent: supplierRepliesOut + buyerRepliesOut,
    suppliers: {
      byEmployee: supplierByEmployee,
      totalSigned: signedSuppliers.length,
      totalNew: newSups.length,
      totalSourcing: sourcingSups.length,
    },
    buyers: {
      byEmployee: buyerByEmployee,
      totalActive: activeBuyers.length,
      totalSourcing: sourcingBuyers.length,
    },
    emailActivity: {
      sentTotal: totalEmailsSent,
      introsSent,
      followupsSent,
      responsesReceived: supplierRepliesIn + buyerRepliesIn,
      supplierResponses: supplierRepliesIn,
      buyerResponses: buyerRepliesIn,
      repliesSentByUs: supplierRepliesOut + buyerRepliesOut,
    },
    deals: {
      byStage: dealsByStage,
      newToday: newDealsToday,
      atRisk: dealsAtRisk,
      totalActivePipelineRevenue,
    },
    tasks: {
      byEmployee: taskByEmployee,
      totalPending: taskByEmployee.reduce((s, t) => s + t.pending, 0),
      totalInProgress: taskByEmployee.reduce((s, t) => s + t.inProgress, 0),
      totalCompleted: taskByEmployee.reduce((s, t) => s + t.completed, 0),
      totalOverdue: taskByEmployee.reduce((s, t) => s + t.overdue, 0),
      createdYesterday,
      completedYesterday,
    },
    attendance: attendanceSummary,
    campaigns: { dueToday, totalActive, awaitingResponse },
    pendingLeaves,
  };
}
