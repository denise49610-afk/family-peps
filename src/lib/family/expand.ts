import { addDays, getDay, startOfDay } from "date-fns";
import { nextBirthday, recurrenceDates, toISODate } from "./dates";
import type {
  Activity,
  Conflict,
  FamilyEvent,
  FamilyMember,
  FamilyState,
  Occurrence,
  Schedule,
} from "./types";

function eventColor(
  event: Pick<FamilyEvent, "color" | "wholeFamily" | "memberIds">,
  members: FamilyMember[],
): Occurrence["color"] {
  if (event.color) return event.color;
  if (event.wholeFamily) return "turquoise";
  const first = members.find((m) => event.memberIds.includes(m.id));
  return first?.color ?? "turquoise";
}

export function expandRange(state: FamilyState, from: Date, to: Date): Occurrence[] {
  const occ: Occurrence[] = [];
  const members = state.members;

  for (const event of state.events) {
    const dates = recurrenceDates(event.date, event.recurrence, from, to);
    for (const date of dates) {
      occ.push({
        id: `event:${event.id}:${date}`,
        sourceType: "event",
        sourceId: event.id,
        title: event.title,
        date,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        location: event.location,
        description: event.description,
        memberIds: event.wholeFamily ? members.map((m) => m.id) : event.memberIds,
        wholeFamily: event.wholeFamily,
        categoryId: event.categoryId,
        color: eventColor(event, members),
        reminderMinutes: event.reminderMinutes,
      });
    }
  }

  for (const schedule of state.schedules) {
    occ.push(...expandSchedule(schedule, from, to, members));
  }

  for (const activity of state.activities) {
    occ.push(...expandActivity(activity, from, to, members));
  }

  for (const member of members) {
    if (!member.birthDate) continue;
    let cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = startOfDay(to);
    while (cursor <= end) {
      const next = nextBirthday(member.birthDate, cursor);
      if (!next || next > end) break;
      const date = toISODate(next);
      occ.push({
        id: `bday:${member.id}:${date}`,
        sourceType: "birthday",
        sourceId: member.id,
        title: `Anniversaire de ${member.firstName}`,
        date,
        startTime: "",
        endTime: "",
        allDay: true,
        location: "",
        description: "",
        memberIds: [member.id],
        wholeFamily: true,
        categoryId: "cat-famille",
        color: member.color,
        reminderMinutes: 1440,
      });
      cursor = addDays(next, 1);
    }
  }

  occ.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.startTime || "99").localeCompare(b.startTime || "99");
  });
  return occ;
}

export function expandSchedule(
  schedule: Schedule,
  from: Date,
  to: Date,
  members: FamilyMember[],
): Occurrence[] {
  const member = members.find((m) => m.id === schedule.memberId);
  const occ: Occurrence[] = [];
  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    const dow = getDay(cursor);
    const date = toISODate(cursor);
    for (const slot of schedule.slots) {
      if (slot.dayOfWeek !== dow) continue;
      occ.push({
        id: `sch:${schedule.id}:${slot.id}:${date}`,
        sourceType: "schedule",
        sourceId: schedule.id,
        title: slot.subject,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        allDay: false,
        location: slot.room,
        description: [slot.teacher, schedule.name].filter(Boolean).join(" · "),
        memberIds: [schedule.memberId],
        wholeFamily: false,
        categoryId: "cat-ecole",
        color: member?.color ?? "orange",
        reminderMinutes: null,
      });
    }
    cursor = addDays(cursor, 1);
  }
  return occ;
}

export function expandActivity(
  activity: Activity,
  from: Date,
  to: Date,
  members: FamilyMember[],
): Occurrence[] {
  // Aucun jour sélectionné = aucune occurrence (évite d'afficher partout)
  if (!activity.weekdays?.length) return [];
  const first = members.find((m) => activity.memberIds.includes(m.id));
  const occ: Occurrence[] = [];
  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    const dow = getDay(cursor);
    if (activity.weekdays.includes(dow)) {
      const date = toISODate(cursor);
      occ.push({
        id: `act:${activity.id}:${date}`,
        sourceType: "activity",
        sourceId: activity.id,
        title: activity.name,
        date,
        startTime: activity.startTime,
        endTime: activity.endTime,
        allDay: false,
        location: activity.location,
        description: activity.notes,
        memberIds: activity.memberIds,
        wholeFamily: false,
        categoryId: activity.categoryId,
        color: first?.color ?? "vert",
        reminderMinutes: 60,
      });
    }
    cursor = addDays(cursor, 1);
  }
  return occ;
}

export function detectConflicts(occurrences: Occurrence[]): Conflict[] {
  const timed = occurrences.filter((o) => !o.allDay && o.startTime);
  const conflicts: Conflict[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.date !== b.date) continue;
      const shared = a.memberIds.filter((id) => b.memberIds.includes(id));
      if (shared.length === 0) continue;
      const aStart = toMin(a.startTime);
      const aEnd = toMin(a.endTime || a.startTime);
      const bStart = toMin(b.startTime);
      const bEnd = toMin(b.endTime || b.startTime);
      if (!(aStart < bEnd && bStart < aEnd)) continue;
      const schoolVsActivity =
        (a.sourceType === "schedule" && b.sourceType === "activity") ||
        (b.sourceType === "schedule" && a.sourceType === "activity");
      for (const memberId of shared) {
        conflicts.push({
          id: `${a.id}|${b.id}|${memberId}`,
          memberId,
          a,
          b,
          reason: schoolVsActivity ? "school-activity" : "overlap",
        });
      }
    }
  }
  return conflicts;
}

function toMin(hhmm: string): number {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

export function reminderLabel(occ: Occurrence, now = new Date()): string | null {
  if (occ.reminderMinutes == null) return null;
  const start = combine(occ.date, occ.startTime || "09:00");
  const diffMin = Math.round((start.getTime() - now.getTime()) / 60000);
  if (diffMin < -15) return null;
  if (diffMin <= 0) return `Maintenant : ${occ.title}`;
  if (diffMin <= 90) return `Dans ${diffMin} min : ${occ.title}`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `Dans ${hours} h : ${occ.title}`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `Dans ${days} j : ${occ.title}`;
  return null;
}

function combine(dateISO: string, time: string): Date {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h || 0, m || 0, 0);
}
