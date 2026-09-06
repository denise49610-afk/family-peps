import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  getDay,
  isWithinInterval,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { capitalize } from "@/lib/utils";
import type { Recurrence } from "./types";

export function parseDate(iso: string): Date {
  return startOfDay(parseISO(iso));
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

export function formatClock(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  return `${String(Number(h)).padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

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

export function daysUntil(date: Date, from = new Date()): number {
  const a = startOfDay(from);
  const b = startOfDay(date);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export const WEEKDAYS_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export const WEEKDAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function weekdayLabel(day: number, short = false): string {
  return short ? WEEKDAYS_SHORT[day] ?? "" : WEEKDAYS_FR[day] ?? "";
}

export function mondayIndex(weekStartsOn: 0 | 1): number[] {
  return weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}

export function recurrenceDates(
  startISO: string,
  recurrence: Recurrence,
  from: Date,
  to: Date,
): string[] {
  const start = parseDate(startISO);
  if (recurrence.freq === "none") {
    if (isWithinInterval(start, { start: startOfDay(from), end: startOfDay(to) })) {
      return [startISO];
    }
    return startISO >= toISODate(from) && startISO <= toISODate(to) ? [startISO] : [];
  }

  const until = recurrence.until ? parseDate(recurrence.until) : to;
  const endBound = until < to ? until : to;
  const interval = Math.max(1, recurrence.interval || 1);
  const out: string[] = [];
  const rangeStart = startOfDay(from);
  const rangeEnd = startOfDay(endBound);
  let guard = 0;

  if (recurrence.freq === "weekly" && recurrence.byWeekday && recurrence.byWeekday.length > 0) {
    let cursor = start < rangeStart ? rangeStart : start;
    while (cursor <= rangeEnd && guard < 800) {
      guard += 1;
      if (cursor >= start && cursor >= rangeStart) {
        const dow = getDay(cursor);
        if (recurrence.byWeekday.includes(dow)) {
          const weeksFromStart = Math.floor(differenceInCalendarDays(cursor, start) / 7);
          if (weeksFromStart % interval === 0) {
            out.push(toISODate(cursor));
          }
        }
      }
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  let cursor = start;
  while (cursor <= endBound && guard < 800) {
    guard += 1;
    if (cursor >= rangeStart && cursor <= rangeEnd) {
      const dow = getDay(cursor);
      if (!recurrence.byWeekday || recurrence.byWeekday.includes(dow)) {
        out.push(toISODate(cursor));
      }
    }
    if (recurrence.freq === "daily") cursor = addDays(cursor, interval);
    else if (recurrence.freq === "weekly") cursor = addDays(cursor, 7 * interval);
    else if (recurrence.freq === "monthly") cursor = addMonths(cursor, interval);
    else if (recurrence.freq === "yearly") cursor = addYears(cursor, interval);
    else break;
  }
  return out;
}
