/**
 * « Balance tout » — parse un texte en vrac (et heuristiques) vers
 * événements / activités / tâches, sans obliger l’utilisateur à choisir le formulaire.
 */

import { todayISO } from "./dates";
import type { FamilyMember } from "./types";
import { CAT } from "./ids";
import { NONE_RECURRENCE } from "./types";

export type DumpKind = "event" | "activity" | "task";

export type DumpProposal = {
  id: string;
  kind: DumpKind;
  title: string;
  memberIds: string[];
  date?: string;
  startTime?: string;
  endTime?: string;
  weekdays?: number[];
  notes?: string;
  confidence: "high" | "medium" | "low";
  raw: string;
  selected: boolean;
};

const DAY_MAP: Record<string, number> = {
  dimanche: 0, dim: 0, lundi: 1, lun: 1, mardi: 2, mar: 2,
  mercredi: 3, mer: 3, jeudi: 4, jeu: 4, vendredi: 5, ven: 5, samedi: 6, sam: 6,
};

const ACTIVITY_WORDS =
  /\b(jjb|judo|ju[\s-]?jitsu|foot|football|sport|piscine|natation|danse|musique|piano|guitare|tennis|basket|hand|karat[eé]|boxe|gym|escalade|équitation|atelier|stage|entraînement|entrainement|club)\b/i;

const EVENT_WORDS =
  /\b(m[eé]decin|docteur|dentiste|orthodontiste|ophtalmo|p[eé]diatre|rdv|rendez[\s-]?vous|r[eé]union|contr[oô]le|vaccin|urgence|h[oô]pital|labo|prise de sang|parent.?prof|r[eé]union parents)\b/i;

const TASK_WORDS =
  /\b(acheter|rappeler|penser [aà]|ne pas oublier|devoirs|fournitures|inscription|papier|dossier|résilier|payer|commander)\b/i;

function normTime(h: string, m?: string): string {
  const hh = String(Math.min(23, parseInt(h, 10) || 0)).padStart(2, "0");
  const mm = String(Math.min(59, parseInt(m || "0", 10) || 0)).padStart(2, "0");
  return `${hh}:${mm}`;
}

function extractTimes(line: string): string[] {
  const times: string[] = [];
  const re = /\b(\d{1,2})\s*[hH:](\d{2})?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    times.push(normTime(m[1], m[2]));
  }
  return times;
}

function extractDays(line: string): number[] {
  const lower = line.toLowerCase();
  const days: number[] = [];
  for (const [word, d] of Object.entries(DAY_MAP)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower) && !days.includes(d)) {
      days.push(d);
    }
  }
  return days;
}

function matchMembers(line: string, members: FamilyMember[]): string[] {
  const lower = line.toLowerCase();
  const ids: string[] = [];
  for (const m of members) {
    const names = [m.firstName, m.nickname, m.lastName].filter(Boolean) as string[];
    for (const n of names) {
      if (n.length >= 2 && lower.includes(n.toLowerCase())) {
        ids.push(m.id);
        break;
      }
    }
  }
  if (/\bmaman\b|\bmère\b/i.test(line)) {
    const parents = members.filter((x) => x.role === "parent");
    if (parents[0]) ids.push(parents[0].id);
  }
  if (/\bpapa\b|\bpère\b/i.test(line)) {
    const parents = members.filter((x) => x.role === "parent");
    if (parents.length >= 2) ids.push(parents[1].id);
    else if (parents[0]) ids.push(parents[0].id);
  }
  return [...new Set(ids)];
}

function guessTitle(line: string, kind: DumpKind): string {
  let t = line
    .replace(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\b/gi, " ")
    .replace(/\b\d{1,2}\s*[hH:]\d{0,2}\b/g, " ")
    .replace(/\b(maman|papa|mère|père)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) {
    if (kind === "activity") return "Activité";
    if (kind === "task") return "Tâche";
    return "Rendez-vous";
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function endAfter(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function classify(line: string): DumpKind {
  if (ACTIVITY_WORDS.test(line)) return "activity";
  if (EVENT_WORDS.test(line)) return "event";
  if (TASK_WORDS.test(line)) return "task";
  const times = extractTimes(line);
  const days = extractDays(line);
  if (days.length >= 1 && times.length >= 1) return "activity";
  if (times.length >= 1) return "event";
  return "task";
}

function splitChunks(text: string): string[] {
  return text
    .split(/\n+|[,;•·]|(?:\s+et\s+)|\s+\/\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

let seq = 0;
function pid(): string {
  seq += 1;
  return `dump-${Date.now()}-${seq}`;
}

export function parseBrainDump(text: string, members: FamilyMember[]): DumpProposal[] {
  const chunks = splitChunks(text);
  const out: DumpProposal[] = [];
  for (const raw of chunks) {
    const kind = classify(raw);
    const times = extractTimes(raw);
    const days = extractDays(raw);
    const memberIds = matchMembers(raw, members);
    const title = guessTitle(raw, kind);
    if (kind === "activity") {
      out.push({
        id: pid(), kind: "activity", title, memberIds,
        weekdays: days.length ? days : undefined,
        startTime: times[0] || "18:00",
        endTime: times[1] || endAfter(times[0] || "18:00", 90),
        confidence: days.length && times.length ? "high" : times.length ? "medium" : "low",
        raw, selected: true,
      });
      continue;
    }
    if (kind === "event") {
      out.push({
        id: pid(), kind: "event", title, memberIds,
        date: todayISO(),
        startTime: times[0] || "09:00",
        endTime: times[1] || endAfter(times[0] || "09:00", 30),
        confidence: times.length ? "high" : "medium",
        raw, selected: true,
      });
      continue;
    }
    out.push({
      id: pid(), kind: "task", title, memberIds,
      date: todayISO(), confidence: "medium", raw, selected: true,
    });
  }
  return out;
}

export function proposalToPayload(p: DumpProposal) {
  if (p.kind === "event") {
    return {
      kind: "event" as const,
      data: {
        title: p.title, memberIds: p.memberIds, wholeFamily: false,
        categoryId: EVENT_WORDS.test(p.raw) ? CAT.sante : CAT.rdv,
        date: p.date || todayISO(),
        startTime: p.startTime || "09:00", endTime: p.endTime || "10:00",
        allDay: false, location: "", description: p.raw,
        reminderMinutes: 60, color: null as string | null,
        recurrence: NONE_RECURRENCE, attachmentIds: [] as string[],
      },
    };
  }
  if (p.kind === "activity") {
    const weekdays = p.weekdays?.length ? p.weekdays : [1, 2, 3, 4, 5];
    const startTime = p.startTime || "18:00";
    const endTime = p.endTime || "19:30";
    return {
      kind: "activity" as const,
      data: {
        name: p.title, memberIds: p.memberIds, weekdays, startTime, endTime,
        daySlots: weekdays.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime })),
        location: "", contactName: "", contactPhone: "", notes: p.raw,
        categoryId: CAT.sport, attachmentIds: [] as string[], photo: null as string | null,
      },
    };
  }
  return {
    kind: "task" as const,
    data: {
      title: p.title, description: p.raw,
      assigneeId: p.memberIds[0] ?? null, priority: "medium" as const,
      dueDate: p.date || todayISO(), categoryId: CAT.maison,
      recurrence: NONE_RECURRENCE, status: "todo" as const,
      completedAt: null as string | null, attachmentIds: [] as string[],
    },
  };
}
