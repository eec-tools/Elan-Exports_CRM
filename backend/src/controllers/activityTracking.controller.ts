import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

// ─── Track Activity Event ─────────────────────────────
export async function trackActivityEvent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      sessionId,
      eventType,
      page,
      details,
      activeSeconds,
      idleSeconds,
      clickCount,
      keyCount,
      scrollDepth,
    } = req.body;

    if (!sessionId || !eventType) {
      res.status(400).json({ error: "sessionId and eventType are required" });
      return;
    }

    await prisma.activityEvent.create({
      data: {
        userId,
        sessionId,
        eventType,
        page: page || null,
        details: details || null,
        activeSeconds: activeSeconds || 0,
        idleSeconds: idleSeconds || 0,
        clickCount: clickCount || 0,
        keyCount: keyCount || 0,
        scrollDepth: scrollDepth || 0,
      },
    });

    res.json({ message: "Activity recorded" });
  } catch (err) {
    console.error("Track activity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Batch Track Multiple Events ──────────────────────
export async function trackActivityBatch(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: "events array is required" });
      return;
    }

    const data = events.map((e: any) => ({
      userId,
      sessionId: e.sessionId,
      eventType: e.eventType,
      page: e.page || null,
      details: e.details || null,
      activeSeconds: e.activeSeconds || 0,
      idleSeconds: e.idleSeconds || 0,
      clickCount: e.clickCount || 0,
      keyCount: e.keyCount || 0,
      scrollDepth: e.scrollDepth || 0,
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    }));

    await prisma.activityEvent.createMany({ data });

    res.json({ message: `Recorded ${data.length} events` });
  } catch (err) {
    console.error("Track activity batch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Get My Activity Summary ──────────────────────────
export async function getMyActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { from, to } = req.query;

    const endDate = to ? new Date(to as string) : new Date();
    const startDate = from ? new Date(from as string) : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const events = await prisma.activityEvent.findMany({
      where: {
        userId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: "desc" },
    });

    // Aggregate by page
    const pageMap = new Map<string, {
      page: string;
      totalActiveSeconds: number;
      totalIdleSeconds: number;
      totalClicks: number;
      totalKeys: number;
      visitCount: number;
    }>();

    let totalActiveSeconds = 0;
    let totalIdleSeconds = 0;
    let totalClicks = 0;
    let totalKeys = 0;

    for (const e of events) {
      totalActiveSeconds += e.activeSeconds;
      totalIdleSeconds += e.idleSeconds;
      totalClicks += e.clickCount;
      totalKeys += e.keyCount;

      if (e.page) {
        let entry = pageMap.get(e.page);
        if (!entry) {
          entry = {
            page: e.page,
            totalActiveSeconds: 0,
            totalIdleSeconds: 0,
            totalClicks: 0,
            totalKeys: 0,
            visitCount: 0,
          };
          pageMap.set(e.page, entry);
        }
        entry.totalActiveSeconds += e.activeSeconds;
        entry.totalIdleSeconds += e.idleSeconds;
        entry.totalClicks += e.clickCount;
        entry.totalKeys += e.keyCount;
        entry.visitCount++;
      }
    }

    // Aggregate by day
    const dayMap = new Map<string, {
      date: string;
      activeSeconds: number;
      idleSeconds: number;
      clicks: number;
      keys: number;
      events: number;
    }>();

    for (const e of events) {
      const dateKey = e.timestamp.toISOString().split("T")[0];
      let entry = dayMap.get(dateKey);
      if (!entry) {
        entry = { date: dateKey, activeSeconds: 0, idleSeconds: 0, clicks: 0, keys: 0, events: 0 };
        dayMap.set(dateKey, entry);
      }
      entry.activeSeconds += e.activeSeconds;
      entry.idleSeconds += e.idleSeconds;
      entry.clicks += e.clickCount;
      entry.keys += e.keyCount;
      entry.events++;
    }

    const pages = Array.from(pageMap.values()).sort((a, b) => b.totalActiveSeconds - a.totalActiveSeconds);
    const dailyBreakdown = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      from: startDate,
      to: endDate,
      summary: {
        totalActiveSeconds,
        totalIdleSeconds,
        totalClicks,
        totalKeys,
        totalEvents: events.length,
        totalActiveLabel: formatSeconds(totalActiveSeconds),
        totalIdleLabel: formatSeconds(totalIdleSeconds),
      },
      pages,
      dailyBreakdown,
    });
  } catch (err) {
    console.error("Get my activity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Admin: Get All Users Activity ────────────────────
export async function getAdminActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { from, to, userId } = req.query;

    const endDate = to ? new Date(to as string) : new Date();
    const startDate = from ? new Date(from as string) : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const whereClause: any = {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (userId) {
      whereClause.userId = userId as string;
    }

    const events = await prisma.activityEvent.findMany({
      where: whereClause,
      include: {
        user: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { timestamp: "desc" },
    });

    // Aggregate per user
    const userMap = new Map<string, {
      userId: string;
      fullName: string;
      email: string;
      totalActiveSeconds: number;
      totalIdleSeconds: number;
      totalClicks: number;
      totalKeys: number;
      totalEvents: number;
      pages: Map<string, number>;
    }>();

    for (const e of events) {
      let entry = userMap.get(e.userId);
      if (!entry) {
        entry = {
          userId: e.userId,
          fullName: e.user.fullName,
          email: e.user.email,
          totalActiveSeconds: 0,
          totalIdleSeconds: 0,
          totalClicks: 0,
          totalKeys: 0,
          totalEvents: 0,
          pages: new Map(),
        };
        userMap.set(e.userId, entry);
      }
      entry.totalActiveSeconds += e.activeSeconds;
      entry.totalIdleSeconds += e.idleSeconds;
      entry.totalClicks += e.clickCount;
      entry.totalKeys += e.keyCount;
      entry.totalEvents++;
      if (e.page) {
        entry.pages.set(e.page, (entry.pages.get(e.page) || 0) + 1);
      }
    }

    const userSummaries = Array.from(userMap.values())
      .map((u) => ({
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        totalActiveSeconds: u.totalActiveSeconds,
        totalIdleSeconds: u.totalIdleSeconds,
        totalClicks: u.totalClicks,
        totalKeys: u.totalKeys,
        totalEvents: u.totalEvents,
        totalActiveLabel: formatSeconds(u.totalActiveSeconds),
        totalIdleLabel: formatSeconds(u.totalIdleSeconds),
        topPages: Array.from(u.pages.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([page, count]) => ({ page, visits: count })),
      }))
      .sort((a, b) => b.totalActiveSeconds - a.totalActiveSeconds);

    res.json({
      from: startDate,
      to: endDate,
      userSummaries,
    });
  } catch (err) {
    console.error("Get admin activity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
