/**
 * IA de coordination familiale
 * Détecte aussi les RDV génériques parent + enfant au même horaire
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
function isParent(m: FamilyMember): boolean {
  return m.role === "parent";
}
function isChild(m: FamilyMember): boolean {
  return m.role === "enfant";
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
  return ids.map((id) => memberName(members.find((m) => m.id === id))).join(", ") || "?";
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
  const parents = members.filter(isParent);
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

  // Conflit parent + enfant au même horaire (même si le titre est juste « Rdv »)
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]!, b = timed[j]!;
      if (!overlaps(a, b)) continue;
      if (a.memberIds.some((id) => b.memberIds.includes(id))) continue;

      const aParents = a.memberIds.filter((id) => parents.some((p) => p.id === id));
      const bParents = b.memberIds.filter((id) => parents.some((p) => p.id === id));
      const aChildren = a.memberIds.filter((id) => children.some((c) => c.id === id));
      const bChildren = b.memberIds.filter((id) => children.some((c) => c.id === id));

      const parentChildCross =
        (aParents.length > 0 && bChildren.length > 0) ||
        (bParents.length > 0 && aChildren.length > 0);

      if (!parentChildCross) continue;

      const childOcc = aChildren.length ? a : b;
      const parentOcc = childOcc === a ? b : a;
      const childWho = names(childOcc.memberIds, members);
      const parentWho = names(parentOcc.memberIds, members);

      problems.push({
        id: `prob-cross-${childOcc.id}-${parentOcc.id}`,
        severity: "red",
        title: `Conflit : ${childOcc.title} // ${parentOcc.title}`,
        description: `${childWho} a « ${childOcc.title} » (${childOcc.startTime}–${childOcc.endTime || "?"}) pendant que ${parentWho} a « ${parentOcc.title} » (${parentOcc.startTime}–${parentOcc.endTime || "?"}). Qui accompagne l'enfant ?`,
        relatedOccIds: [childOcc.id, parentOcc.id],
        needBy: childOcc.startTime,
      });

      const otherParents = parents.filter((p) => !parentOcc.memberIds.includes(p.id));
      if (otherParents.length > 0) {
        const op = otherParents[0]!;
        solutions.push({
          id: `sol-cross-other-${childOcc.id}`, rank: 1,
          title: `${memberName(op)} accompagne ${childWho}`,
          summary: `Pendant le RDV de ${parentWho}, ${memberName(op)} emmène ${childWho} à « ${childOcc.title} ».`,
          why: "Un autre parent est disponible sur le papier.",
          steps: [
            { time: childOcc.startTime, actorId: op.id, action: `Accompagner ${childWho} — ${childOcc.title}` },
          ],
          pros: [`${parentWho} garde « ${parentOcc.title} »`], cons: [],
          requiresChange: false, score: 95, feasible: true, confidence: "known",
        });
      } else {
        solutions.push({
          id: `sol-cross-other-${childOcc.id}`, rank: 1,
          title: "L'autre parent ou un proche y va",
          summary: `Pendant « ${parentOcc.title} » de ${parentWho}, un autre adulte emmène ${childWho} à « ${childOcc.title} ».`,
          why: "Parent et enfant ont un RDV au même moment.",
          steps: [
            { action: "Appeler l'autre parent / un grand-parent" },
            { time: childOcc.startTime, action: `Accompagner ${childWho}` },
          ],
          pros: [`${parentWho} garde son RDV`], cons: ["Besoin d'un tiers"],
          requiresChange: true, score: 88, feasible: true, confidence: "assumed",
        });
      }
      solutions.push({
        id: `sol-cross-move-${childOcc.id}`, rank: 2,
        title: "Décaler l'un des deux RDV",
        summary: `Décaler « ${parentOcc.title} » de ${parentWho} ou « ${childOcc.title} » de ${childWho} pour ne plus se chevaucher.`,
        why: "Un seul adulte ne peut pas être à deux endroits.",
        steps: [{ action: "Appeler pour décaler l'un des créneaux" }],
        pros: ["Plus de conflit"], cons: ["Coup de fil"],
        requiresChange: true, score: 70, feasible: true, confidence: "known",
      });
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
      : analysis.status === "ok" ? "Aucune action particulière. Tout le monde est à l'heure."
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
