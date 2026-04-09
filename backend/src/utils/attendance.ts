import { AttendanceHeartbeat } from "@prisma/client";

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ParsedTime {
  hours: number;
  minutes: number;
}

export interface AttendanceSummary {
  totalTimeMinutes: number;
  idleTimeMinutes: number;
  realTimeMinutes: number;
}

export function parseHHMM(value: string): ParsedTime | null {
  const match = TIME_24H_REGEX.exec(value);
  if (!match) return null;

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

export function hhmmToMinutes(value: string): number | null {
  const parsed = parseHHMM(value);
  if (!parsed) return null;
  return parsed.hours * 60 + parsed.minutes;
}

export function startOfLocalDay(input: Date = new Date()): Date {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function buildWorkDateTime(baseDate: Date, hhmm: string): Date | null {
  const parsed = parseHHMM(hhmm);
  if (!parsed) return null;

  const date = new Date(baseDate);
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

export function diffMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

export function computeIdleMinutes(
  start: Date,
  end: Date,
  heartbeats: Array<Pick<AttendanceHeartbeat, "timestamp">>,
): number {
  if (end <= start) return 0;

  const points = [
    start,
    ...heartbeats
      .map((hb) => new Date(hb.timestamp))
      .filter((ts) => ts > start && ts < end)
      .sort((a, b) => a.getTime() - b.getTime()),
    end,
  ];

  let idleMinutes = 0;
  for (let i = 1; i < points.length; i += 1) {
    const gap = diffMinutes(points[i - 1], points[i]);
    if (gap > 5) {
      idleMinutes += gap - 5;
    }
  }

  return idleMinutes;
}

export function calculateAttendanceSummary(
  start: Date,
  end: Date,
  heartbeats: Array<Pick<AttendanceHeartbeat, "timestamp">>,
): AttendanceSummary {
  const totalTimeMinutes = diffMinutes(start, end);
  const idleTimeMinutes = computeIdleMinutes(start, end, heartbeats);
  const realTimeMinutes = Math.max(0, totalTimeMinutes - idleTimeMinutes);

  return {
    totalTimeMinutes,
    idleTimeMinutes,
    realTimeMinutes,
  };
}

export function formatMinutes(minutes: number): string {
  const clamped = Math.max(0, minutes);
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export function isValidWorkWindow(
  workStartTime: string,
  workEndTime: string,
): string | null {
  const start = hhmmToMinutes(workStartTime);
  const end = hhmmToMinutes(workEndTime);

  if (start === null || end === null) {
    return "Work start and end times must be in HH:mm format";
  }

  if (start >= end) {
    return "work_start_time must be earlier than work_end_time";
  }

  return null;
}
