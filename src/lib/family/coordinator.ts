/**
 * IA de coordination familiale
 */
import { addDays, parseISO } from "date-fns";
import { expandRange, detectConflicts } from "./expand";
import { todayISO, toISODate } from "./dates";
import type { FamilyMember, FamilyState, Occurrence, Conflict } from "./types";

export type LogisticsProblem = {
  id: string;
  severity: "red" | "orange" | "yellow";
  title: string;
  description: string;
  relatedOccIds: string[];
  childId?: string;
  activityOcc?: Occurrence;
  freeFrom?: string;
  needBy?: string;
};
export type SolutionStep = { time?: string; actorId?: string; action: string; detail?: string };
export type RankedSolution = {
  id: string; rank: 1 | 2 | 3 | 4; title: string; summary: string; why: string;
  steps: SolutionStep[]; pros: string[]; cons: string[]; requiresChange: boolean;
  score: number; feasible: boolean; confidence: "known" | "assumed" | "missing";
};
export type DayCoordination = {
  date: string; label: string; status: "ok" | "needs-org" | "conflict";
  problems: LogisticsProblem[]; solutions: RankedSolution[]; best?: RankedSolution;
  occurrences: Occurrence[]; conflicts: Conflict[]; summaryLine: string;
};
export type CoordinationResult = {
  days: DayCoordination[]; overallStatus: "ok" | "needs-org" | "conflict";
  headline: string; nextAction?: string;
};

function toMin(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fromMin(mins: number): string {
  const h = Math.floor(Math.max(0, mins) / 60);
  const m = Math.max(0, mins) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function memberName(m?: FamilyMember | null): string {
  if (!m) return "?";
  return m.nickname || m.firstName || "?";
}
function isParent(m: FamilyMember, all: FamilyMember[]): boolean {
  if (m.role === "parent") return true;
  if (m.role === "enfant") return false;
  return !all.some((x) => x.role === "parent");
}
function isChild(m: FamilyMember): boolean {
  return m.role === "enfant";
}
const NEEDS_ESCORT =
  /ophtalmo|dentiste|m[eé]decin|docteur|orthodont|p[eé]diatre|h[oô]pital|labo|vaccin|kin[eé]|psy|orl|radiologie|analyse|urgence|contr[oô]le|\brdv\b/i;
const PARENT_OBLIGATION =
  /r[eé]union|meeting|visio|appel|travail|bureau|formation|entretien|client|job/i;
function needsEscort(o: Occurrence): boolean {
  return NEEDS_ESCORT.test(`${o.title} ${o.location} ${o.description}`);
}
function isParentObligation(o: Occurrence): boolean {
  return PARENT_OBLIGATION.test(`${o.title} ${o.location} ${o.description}`);
}
function endsAround(o: Occurrence): number {
  return o.endTime ? toMin(o.endTime) : toMin(o.startTime) + 30;
}
function startsAround(o: Occurrence): number {
  return toMin(o.startTime || "00:00");
}
function overlaps(a: Occurrence, b: Occurrence): boolean {
  return startsAround(a) < endsAround(b) && startsAround(b) < endsAround(a);
}
function names(ids: string[], members: FamilyMember[]): string {
  return ids.map((id) => memberName(members.find((m) => m.id === id))).join(", ");
}

export function estimateTravel(from: string, to: string, margin = 10) {
  const a = (from || "").toLowerCase();
  const b = (to || "").toLowerCase();
  if (!a || !b || a === b) return { theoretical: 5, withMargin: 5 + margin, note: "Proche" };
  return { theoretical: 15, withMargin: 15 + margin, note: "Trajet estimé" };
}

function analyzeSingleDay(state: FamilyState, date: string): DayCoordination {
  const rangeStart = parseISO(date);
  const occurrences = expandRange(state, rangeStart, rangeStart).filter((o) => o.date === date);
  const conflicts = detectConflicts(occurrences);
  const problems: LogisticsProblem[] = [];
  const solutions: RankedSolution[] = [];
  const members = state.members;
  const parents = members.filter((m) => isParent(m, members));
  const children = members.filter(isChild);

  for (const c of conflicts) {
    problems.push({
      id: `prob-conflict-${c.id}`,
      severity: "orange",
      title: `Chevauchement : ${c.a.title} / ${c.b.title}`,
      description: `${memberName(members.find((m) => m.id === c.memberId))} a deux obligations en même temps.`,
      relatedOccIds: [c.a.id, c.b.id],
    });
    solutions.push({
      id: `sol-conflict-${c.id}`, rank: 1, title: "Décaler ou prioriser",
      summary: `Choisir entre « ${c.a.title} » et « ${c.b.title} ».`,
      why: "Même personne, deux créneaux.", steps: [{ action: "Décaler l'un des deux" }],
      pros: ["Plus de double booking"], cons: [], requiresChange: true, score: 80, feasible: true, confidence: "known",
    });
  }

  const timed = occurrences.filter((o) => !o.allDay && o.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]!, b = timed[j]!;
      if (!overlaps(a, b)) continue;
      if (a.memberIds.some((id) => b.memberIds.includes(id))) continue;
      const aEsc = needsEscort(a), bEsc = needsEscort(b);
      const aObl = isParentObligation(a), bObl = isParentObligation(b);
      if (!((aEsc && bObl) || (bEsc && aObl))) continue;
      const medical = aEsc ? a : b;
      const obligation = aEsc ? b : a;
      const medicalWho = names(medical.memberIds, members);
      const obligWho = names(obligation.memberIds, members);

      problems.push({
        id: `prob-cross-${medical.id}-${obligation.id}`,
        severity: "red",
        title: `Conflit : ${medical.title} // ${obligation.title}`,
        description: `${medicalWho} a « ${medical.title} » (${medical.startTime}–${medical.endTime || "?"}) pendant que ${obligWho} a « ${obligation.title} » (${obligation.startTime}–${obligation.endTime || "?"}). Qui accompagne ?`,
        relatedOccIds: [medical.id, obligation.id],
        needBy: medical.startTime,
      });

      solutions.push({
        id: `sol-cross-other-${medical.id}`, rank: 1,
        title: "L'autre parent ou un proche y va",
        summary: `Pendant « ${obligation.title} » de ${obligWho}, un autre adulte emmène ${medicalWho} à « ${medical.title} ».`,
        why: "Deux obligations familiales au même horaire.",
        steps: [
          { action: "Confirmer qui est disponible (autre parent / grand-parent)" },
          { time: medical.startTime, action: `Accompagner ${medicalWho} — ${medical.title}`, detail: medical.location || undefined },
        ],
        pros: [`${obligWho} garde sa réunion`], cons: ["Besoin d'un second adulte"],
        requiresChange: true, score: 90, feasible: true, confidence: "assumed",
      });
      solutions.push({
        id: `sol-cross-visio-${medical.id}`, rank: 2,
        title: "Réunion en visio ou décalée",
        summary: `${obligWho} fait « ${obligation.title} » en visio (salle d'attente) ou la décale de 30–45 min pour emmener ${medicalWho}.`,
        why: `Chevauchement entre « ${obligation.title} » et « ${medical.title} ».`,
        steps: [
          { time: obligation.startTime, action: `Prévenir : visio ou report de « ${obligation.title} »` },
          { time: medical.startTime, action: `Emmener ${medicalWho} — ${medical.title}` },
        ],
        pros: ["Un parent de la famille peut y aller"], cons: ["La réunion change"],
        requiresChange: true, score: 82, feasible: true, confidence: "assumed",
      });
      solutions.push({
        id: `sol-cross-move-${medical.id}`, rank: 3,
        title: "Reporter le RDV médical",
        summary: `Appeler pour décaler « ${medical.title} » de ${medicalWho} hors de la plage « ${obligation.title} ».`,
        why: "Libère le créneau sans toucher à la réunion.",
        steps: [{ action: `Appeler le cabinet pour reporter « ${medical.title} »` }],
        pros: ["Planning parent inchangé"], cons: ["Soin reporté"],
        requiresChange: true, score: 55, feasible: true, confidence: "known",
      });
    }
  }

  for (const child of children) {
    for (const appt of timed.filter((o) => o.memberIds.includes(child.id) && needsEscort(o))) {
      if (problems.some((p) => p.relatedOccIds.includes(appt.id))) continue;
      const free = parents.filter((p) => {
        const w0 = startsAround(appt), w1 = endsAround(appt);
        return !timed.some((o) => o.memberIds.includes(p.id) && startsAround(o) < w1 && endsAround(o) > w0);
      });
      if (free.length === 0 && parents.length > 0) {
        problems.push({
          id: `prob-escort-${child.id}-${appt.id}`, severity: "red",
          title: `Personne pour accompagner ${memberName(child)}`,
          description: `${memberName(child)} : « ${appt.title} » à ${appt.startTime} — tous les parents occupés.`,
          relatedOccIds: [appt.id], childId: child.id, activityOcc: appt, needBy: appt.startTime,
        });
      } else if (free[0]) {
        const p = free[0];
        solutions.push({
          id: `sol-free-${child.id}-${appt.id}`, rank: 1,
          title: `${memberName(p)} accompagne ${memberName(child)}`,
          summary: `${memberName(p)} est libre à ${appt.startTime} pour « ${appt.title} ».`,
          why: "Parent disponible.", steps: [
            { time: appt.startTime, actorId: p.id, action: `Emmener ${memberName(child)} — ${appt.title}` },
          ],
          pros: ["Simple"], cons: [], requiresChange: false, score: 95, feasible: true, confidence: "known",
        });
      }
    }
  }

  solutions.sort((a, b) => b.score - a.score);
  const uniq: RankedSolution[] = [];
  const seen = new Set<string>();
  for (const s of solutions) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    uniq.push(s);
  }
  uniq.forEach((s, i) => { s.rank = Math.min(i + 1, 4) as 1 | 2 | 3 | 4; });
  const best = uniq.find((s) => s.feasible) ?? uniq[0];

  let status: DayCoordination["status"] = "ok";
  if (problems.some((p) => p.severity === "red") || conflicts.length > 0) status = "conflict";
  else if (problems.length > 0) status = "needs-org";

  const label = date === todayISO() ? "Aujourd'hui"
    : date === toISODate(addDays(new Date(), 1)) ? "Demain" : date;

  return {
    date, label, status, problems, solutions: uniq.slice(0, 4), best, occurrences, conflicts,
    summaryLine: status === "conflict" ? "Il y a un vrai conflit d'organisation."
      : status === "needs-org" ? "Une organisation est nécessaire." : "Tout est compatible.",
  };
}

export function coordinateFamily(state: FamilyState, options?: { days?: number; fromDate?: string }): CoordinationResult {
  const daysCount = options?.days ?? 3;
  const start = options?.fromDate ? parseISO(options.fromDate) : new Date();
  const days: DayCoordination[] = [];
  for (let i = 0; i < daysCount; i++) days.push(analyzeSingleDay(state, toISODate(addDays(start, i))));
  const hasConflict = days.some((d) => d.status === "conflict");
  const needsOrg = days.some((d) => d.status === "needs-org");
  if (hasConflict) {
    const first = days.find((d) => d.status === "conflict");
    return {
      days, overallStatus: "conflict",
      headline: "🔴 Il y a un vrai conflit d'organisation.",
      nextAction: first?.best ? `Voir la solution pour ${first.label.toLowerCase()}` : "Examiner les conflits",
    };
  }
  if (needsOrg) {
    const first = days.find((d) => d.status === "needs-org");
    return {
      days, overallStatus: "needs-org",
      headline: "🟠 Une organisation est nécessaire.",
      nextAction: first?.best ? `Voir la solution recommandée pour ${first.label.toLowerCase()}` : "Organiser la journée",
    };
  }
  return { days, overallStatus: "ok", headline: "🟢 Tout va bien pour les prochains jours." };
}

export function organiseMyDay(state: FamilyState, date: string = todayISO()) {
  const analysis = analyzeSingleDay(state, date);
  const membersById = new Map(state.members.map((m) => [m.id, m]));
  const timed = analysis.occurrences.filter((o) => !o.allDay && o.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const timeline = timed.map((o) => ({
    time: o.startTime,
    who: o.wholeFamily ? "Famille" : o.memberIds.map((id) => memberName(membersById.get(id))).join(", "),
    what: o.endTime ? `${o.title} (${o.startTime}–${o.endTime})` : o.title,
  }));
  const best = analysis.best;
  return {
    title: analysis.label, timeline,
    recommendation: best && analysis.status !== "ok" ? best.summary
      : analysis.status === "ok" ? "Aucune action particulière."
      : "Vérifiez qui peut accompagner les RDV.",
    why: best?.why ?? analysis.summaryLine,
    status: analysis.status,
  };
}

export function whatShouldWeDo(state: FamilyState, date: string = todayISO()): string {
  const analysis = analyzeSingleDay(state, date);
  const lines: string[] = [`🏠 ${analysis.label.toUpperCase()}`];
  if (analysis.status !== "ok") lines.push(`⚠️ ${analysis.summaryLine}`);
  if (analysis.best) {
    lines.push(`✅ Solution : ${analysis.best.summary}`);
    for (const step of analysis.best.steps.slice(0, 4)) {
      lines.push(`  • ${step.time ? step.time + " — " : ""}${step.action}`);
    }
  } else if (analysis.status === "ok") {
    lines.push("Rien de spécial — le planning est clair.");
  }
  for (const p of analysis.problems.slice(0, 3)) {
    lines.push(`⚠ ${p.title}`);
    lines.push(`  ${p.description}`);
  }
  const timed = analysis.occurrences.filter((o) => !o.allDay && o.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  if (timed.length) {
    lines.push("", "Timeline :");
    for (const o of timed) lines.push(`  ${o.startTime} — ${o.title}`);
  }
  return lines.join("\n");
}

export function simulateWhatIf(state: FamilyState, date: string, changeDescription: string) {
  const analysis = analyzeSingleDay(state, date);
  return {
    message: `Simulation « ${changeDescription} » — organisation pour ${analysis.label}.`,
    analysis,
  };
}
