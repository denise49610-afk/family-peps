import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  getDay,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { Recurrence } from "./types";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function formatDayLong(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return capitalize(format(d, "EEEE d MMMM yyyy", { locale: fr }));
}

export function formatDayShort(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return capitalize(format(d, "EEE d MMM", { locale: fr }));
}

export function formatMonthTitle(date: Date): string {
  return capitalize(format(date, "MMMM yyyy", { locale: fr }));
}

export function formatTime(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m && m !== "00" ? m : ""}`;
}

/** Horloge type 08:30 — visuel accueil. */
export function formatClock(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  return `${String(Number(h)).padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

/** « Demain », « Lundi », « Aujourd'hui » */
export function relativeDayLabel(dateISO: string, from = new Date()): string {
  const days = daysUntil(parseDate(dateISO), from);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return capitalize(format(parseDate(dateISO), "EEEE", { locale: fr }));
}

export function formatTimeRange(start: string, end: string, allDay?: boolean): string {
  if (allDay) return "Toute la journée";
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  if (start) return formatTime(start);
  return "";
}

export function combineDateTime(dateISO: string, time: string): Date {
  const d = parseISO(dateISO);
  if (!time) return d;
  const [h, m] = time.split(":").map(Number);
  return setMinutes(setHours(d, h || 0), m || 0);
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = (start || "00:00").split(":").map(Number);
  const [eh, em] = (end || "00:00").split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function parseDate(dateISO: string): Date {
  return startOfDay(parseISO(dateISO));
}

export function daysUntil(date: Date, from = new Date()): number {
  return differenceInCalendarDays(startOfDay(date), startOfDay(from));
}

export function weekDates(anchor: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function recurrenceDates(
  startISO: string,
  recurrence: Recurrence,
  from: Date,
  to: Date,
): string[] {
  const start = parseDate(startISO);
  const rangeStart = startOfDay(from);
  const rangeEnd = startOfDay(to);
  const until = recurrence.until ? parseDate(recurrence.until) : null;

  if (recurrence.freq === "none") {
    return start >= rangeStart && start <= rangeEnd ? [startISO] : [];
  }

  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  const interval = Math.max(1, recurrence.interval || 1);

  while (cursor <= rangeEnd && guard < 400) {
    guard += 1;
    if (until && cursor > until) break;
    if (cursor >= rangeStart) {
      if (recurrence.freq === "weekly" && recurrence.byWeekday?.length) {
        if (recurrence.byWeekday.includes(getDay(cursor))) {
          out.push(toISODate(cursor));
        }
      } else {
        out.push(toISODate(cursor));
      }
    }
    if (recurrence.freq === "daily") cursor = addDays(cursor, interval);
    else if (recurrence.freq === "weekly") cursor = addWeeks(cursor, interval);
    else if (recurrence.freq === "monthly") cursor = addMonths(cursor, interval);
    else if (recurrence.freq === "yearly") cursor = addYears(cursor, interval);
    else break;
  }
  return out;
}

export function nextBirthday(birthISO: string, from = new Date()): Date | null {
  if (!birthISO) return null;
  const birth = parseISO(birthISO);
  const year = from.getFullYear();
  let next = new Date(year, birth.getMonth(), birth.getDate());
  if (next < startOfDay(from)) next = new Date(year + 1, birth.getMonth(), birth.getDate());
  return next;
}
