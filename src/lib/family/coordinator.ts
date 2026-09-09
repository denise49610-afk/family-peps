/**
 * IA de coordination familiale — analyse planning et propose une organisation.
 */
import { addDays, parseISO } from "date-fns";
import { expandRange, detectConflicts } from "./expand";
import { todayISO, toISODate } from "./dates";
import type { FamilyMember, FamilyState, Occurrence, Conflict } from "./types";

export type ConstraintLevel = "obligation" | "important" | "flexible";

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

export type SolutionStep = {
  time?: string;
  actorId?: string;
  action: string;
  detail?: string;
};

export type RankedSolution = {
  id: string;
  rank: 1 | 2 | 3 | 4;
  title: string;
  summary: string;
  why: string;
  steps: SolutionStep[];
  pros: string[];
  cons: string[];
  requiresChange: boolean;
  score: number;
  feasible: boolean;
  confidence: "known" | "assumed" | "missing";
};

export type DayCoordination = {
  date: string;
  label: string;
  status: "ok" | "needs-org" | "conflict";
  problems: LogisticsProblem[];
  solutions: RankedSolution[];
  best?: RankedSolution;
  occurrences: Occurrence[];
  conflicts: Conflict[];
  summaryLine: string;
};

export type CoordinationResult = {
  days: DayCoordination[];
  overallStatus: "ok" | "needs-org" | "conflict";
  headline: string;
  nextAction?: string;
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

export function estimateTravel(
  from: string,
  to: string,
  margin = 10,
): { theoretical: number; withMargin: number; note: string } {
  const a = (from || "").toLowerCase();
  const b = (to || "").toLowerCase();
  if (!a || !b || a === b || (a.includes("maison") && b.includes("maison"))) {
    return { theoretical: 5, withMargin: 5 + margin, note: "Même secteur" };
  }
  if (a.includes("travail") || b.includes("travail")) {
    return { theoretical: 20, withMargin: 20 + margin, note: "Lieu de travail" };
  }
  return { theoretical: 15, withMargin: 15 + margin, note: "Trajet estimé" };
}

function endsAround(o: Occurrence): number {
  return o.endTime ? toMin(o.endTime) : toMin(o.startTime) + 30;
}

function startsAround(o: Occurrence): number {
  return toMin(o.startTime || "00:00");
}

function analyzeSingleDay(state: FamilyState, date: string): DayCoordination {
  const rangeStart = parseISO(date);
  const occurrences = expandRange(state, rangeStart, rangeStart).filter(
    (o) => o.date === date,
  );
  const conflicts = detectConflicts(occurrences);
  const problems: LogisticsProblem[] = [];
  const solutions: RankedSolution[] = [];

  for (const c of conflicts) {
    problems.push({
      id: `prob-conflict-${c.id}`,
      severity: c.reason === "school-activity" ? "red" : "orange",
      title: `Chevauchement : ${c.a.title} / ${c.b.title}`,
      description: `${memberName(state.members.find((m) => m.id === c.memberId))} a deux obligations qui se chevauchent.`,
      relatedOccIds: [c.a.id, c.b.id],
    });
    solutions.push({
      id: `sol-conflict-${c.id}`,
      rank: 1,
      title: "Décaler ou prioriser",
      summary: `Choisir entre « ${c.a.title} » et « ${c.b.title} », ou décaler l'un des deux.`,
      why: "Deux créneaux se superposent pour la même personne.",
      steps: [
        { action: `Vérifier si « ${c.a.title} » peut bouger` },
        { action: `Sinon reporter « ${c.b.title} »` },
      ],
      pros: ["Évite le double booking"],
      cons: ["Peut nécessiter un coup de fil"],
      requiresChange: true,
      score: 80,
      feasible: true,
      confidence: "known",
    });
  }

  // Gaps serrés entre RDV de la même personne
  const timed = occurrences
    .filter((o) => !o.allDay && o.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i]!;
    const b = timed[i + 1]!;
    const same =
      a.wholeFamily ||
      b.wholeFamily ||
      a.memberIds.some((id) => b.memberIds.includes(id));
    if (!same) continue;
    const gap = startsAround(b) - endsAround(a);
    const travel = estimateTravel(a.location || "", b.location || "");
    if (gap < 0) {
      problems.push({
        id: `prob-overlap-${a.id}-${b.id}`,
        severity: "red",
        title: `Chevauchement ${a.title} / ${b.title}`,
        description: `Fin de « ${a.title} » après le début de « ${b.title} ».`,
        relatedOccIds: [a.id, b.id],
      });
    } else if (gap < travel.withMargin + 10) {
      problems.push({
        id: `prob-gap-${a.id}-${b.id}`,
        severity: "orange",
        title: `Enchaînement serré : ${a.title} → ${b.title}`,
        description: `Seulement ${gap} min entre les deux (trajet ~${travel.withMargin} min). Partir dès la fin du premier.`,
        relatedOccIds: [a.id, b.id],
      });
      solutions.push({
        id: `sol-gap-${a.id}-${b.id}`,
        rank: 1,
        title: "Partir immédiatement après le 1er RDV",
        summary: `Dès la fin de « ${a.title} », en route pour « ${b.title} » (prévoir ~${travel.withMargin} min).`,
        why: `Marge trop juste (${gap} min).`,
        steps: [
          { time: a.endTime || a.startTime, action: `Terminer « ${a.title} »` },
          { time: fromMin(endsAround(a) + 2), action: `Départ vers « ${b.title} »` },
          { time: b.startTime, action: `Arriver à « ${b.title} »` },
        ],
        pros: ["Respecte les deux RDV"],
        cons: ["Aucune marge d'imprévu"],
        requiresChange: false,
        score: 75,
        feasible: true,
        confidence: "assumed",
      });
    }
  }

  // Qui emmène les enfants après l'école ?
  const children = state.members.filter(isChild);
  const parents = state.members.filter(isParent);
  for (const child of children) {
    const schoolish = timed.filter(
      (o) =>
        o.memberIds.includes(child.id) &&
        /école|ecole|collège|college|lycée|lycee|sortie/i.test(o.title + o.location),
    );
    const schoolEnd = schoolish.sort((a, b) => endsAround(b) - endsAround(a))[0];
    if (!schoolEnd) continue;
    const nextAct = timed.find(
      (o) =>
        o.memberIds.includes(child.id) &&
        startsAround(o) >= endsAround(schoolEnd) &&
        o.id !== schoolEnd.id,
    );
    if (!nextAct) continue;
    const freeAt = endsAround(schoolEnd);
    const needBy = startsAround(nextAct);
    const travel = estimateTravel(schoolEnd.location || "école", nextAct.location || "");
    if (needBy - freeAt < travel.withMargin + 5) {
      problems.push({
        id: `prob-school-${child.id}-${nextAct.id}`,
        severity: "red",
        title: `Temps insuffisant pour ${memberName(child)}`,
        description: `Sortie ${fromMin(freeAt)} → ${nextAct.title} à ${fromMin(needBy)} (${needBy - freeAt} min, trajet ~${travel.withMargin}).`,
        relatedOccIds: [schoolEnd.id, nextAct.id],
        childId: child.id,
        activityOcc: nextAct,
      });
    } else {
      const available = parents.filter((p) => {
        const blocking = timed.some(
          (o) =>
            o.memberIds.includes(p.id) &&
            startsAround(o) < needBy &&
            endsAround(o) > freeAt,
        );
        return !blocking;
      });
      if (available.length === 0 && parents.length > 0) {
        problems.push({
          id: `prob-parent-${child.id}-${nextAct.id}`,
          severity: "orange",
          title: `Qui emmène ${memberName(child)} ?`,
          description: `Aucun parent libre entre ${fromMin(freeAt)} et ${fromMin(needBy)} pour « ${nextAct.title} ».`,
          relatedOccIds: [schoolEnd.id, nextAct.id],
          childId: child.id,
          activityOcc: nextAct,
        });
        solutions.push({
          id: `sol-parent-${child.id}`,
          rank: 1,
          title: "Demander un proche ou covoiturage",
          summary: `Les parents sont occupés. Prévoir un tiers pour emmener ${memberName(child)} à ${nextAct.title}.`,
          why: "Aucun parent disponible sur le créneau.",
          steps: [
            { action: "Appeler un parent d'élève / grand-parent" },
            { time: nextAct.startTime, action: `Amener ${memberName(child)} à ${nextAct.title}` },
          ],
          pros: ["Parents gardent leurs RDV"],
          cons: ["Dépend d'une tierce personne"],
          requiresChange: true,
          score: 60,
          feasible: true,
          confidence: "assumed",
        });
      } else if (available.length > 0) {
        const p = available[0]!;
        solutions.push({
          id: `sol-ok-${child.id}`,
          rank: 1,
          title: `${memberName(p)} s'en charge`,
          summary: `${memberName(p)} peut récupérer ${memberName(child)} et l'amener à ${nextAct.title}.`,
          why: `${memberName(p)} est libre sur le créneau.`,
          steps: [
            { time: fromMin(freeAt), actorId: p.id, action: `Récupérer ${memberName(child)}` },
            { time: nextAct.startTime, actorId: p.id, action: `Amener à ${nextAct.title}` },
          ],
          pros: ["Simple", "Un parent disponible"],
          cons: [],
          requiresChange: false,
          score: 90,
          feasible: true,
          confidence: "known",
        });
      }
    }
  }

  solutions.sort((a, b) => b.score - a.score);
  solutions.forEach((s, i) => {
    s.rank = Math.min(i + 1, 4) as 1 | 2 | 3 | 4;
  });
  const best = solutions.find((s) => s.feasible) ?? solutions[0];

  let status: DayCoordination["status"] = "ok";
  if (problems.some((p) => p.severity === "red") || conflicts.length > 0) status = "conflict";
  else if (problems.length > 0) status = "needs-org";

  const label =
    date === todayISO()
      ? "Aujourd'hui"
      : date === toISODate(addDays(new Date(), 1))
        ? "Demain"
        : date;

  return {
    date,
    label,
    status,
    problems,
    solutions: solutions.slice(0, 4),
    best,
    occurrences,
    conflicts,
    summaryLine:
      status === "conflict"
        ? "Il y a un vrai conflit d'organisation."
        : status === "needs-org"
          ? "Une organisation est nécessaire."
          : "Tout est compatible.",
  };
}

export function coordinateFamily(
  state: FamilyState,
  options?: { days?: number; fromDate?: string },
): CoordinationResult {
  const daysCount = options?.days ?? 3;
  const start = options?.fromDate ? parseISO(options.fromDate) : new Date();
  const days: DayCoordination[] = [];
  for (let i = 0; i < daysCount; i++) {
    days.push(analyzeSingleDay(state, toISODate(addDays(start, i))));
  }
  const hasConflict = days.some((d) => d.status === "conflict");
  const needsOrg = days.some((d) => d.status === "needs-org");
  let overallStatus: CoordinationResult["overallStatus"] = "ok";
  let headline = "🟢 Tout va bien pour les prochains jours.";
  let nextAction: string | undefined;
  if (hasConflict) {
    overallStatus = "conflict";
    headline = "🔴 Il y a un vrai conflit d'organisation.";
    const first = days.find((d) => d.status === "conflict");
    nextAction = first?.best
      ? `Voir la solution pour ${first.label.toLowerCase()}`
      : "Examiner les conflits";
  } else if (needsOrg) {
    overallStatus = "needs-org";
    headline = "🟠 Une organisation est nécessaire.";
    const first = days.find((d) => d.status === "needs-org");
    nextAction = first?.best
      ? `Voir la solution recommandée pour ${first.label.toLowerCase()}`
      : "Organiser la journée";
  }
  return { days, overallStatus, headline, nextAction };
}

export function organiseMyDay(
  state: FamilyState,
  date: string = todayISO(),
): {
  title: string;
  timeline: { time: string; who: string; what: string }[];
  recommendation: string;
  why: string;
  status: DayCoordination["status"];
} {
  const analysis = analyzeSingleDay(state, date);
  const membersById = new Map(state.members.map((m) => [m.id, m]));
  const timed = analysis.occurrences
    .filter((o) => !o.allDay && o.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const timeline = timed.map((o) => {
    const who = o.wholeFamily
      ? "Famille"
      : o.memberIds.map((id) => memberName(membersById.get(id))).join(", ");
    return {
      time: o.startTime,
      who,
      what: o.endTime ? `${o.title} (${o.startTime}–${o.endTime})` : o.title,
    };
  });
  const best = analysis.best;
  let recommendation: string;
  let why: string;
  if (best && analysis.status !== "ok") {
    recommendation = best.summary;
    why = best.why;
  } else if (timed.length >= 3) {
    recommendation = `Tu as ${timed.length} créneaux. Ordre : ${timed.map((o) => `${o.startTime} ${o.title}`).join(" → ")}. Garde 10–15 min de marge entre chaque déplacement.`;
    why = "Journée chargée — enchaînement chronologique conseillé.";
  } else if (analysis.status === "ok") {
    recommendation = "Aucune action particulière. Tout le monde est à l'heure.";
    why = analysis.summaryLine;
  } else {
    recommendation = "Vérifiez les disponibilités pour les trajets.";
    why = analysis.summaryLine;
  }
  return {
    title: analysis.label,
    timeline,
    recommendation,
    why,
    status: analysis.status,
  };
}

export function whatShouldWeDo(
  state: FamilyState,
  date: string = todayISO(),
): string {
  const analysis = analyzeSingleDay(state, date);
  const lines: string[] = [`🏠 ${analysis.label.toUpperCase()}`];
  if (analysis.best) {
    lines.push(`✅ ${analysis.best.summary}`);
    for (const step of analysis.best.steps.slice(0, 4)) {
      lines.push(`  • ${step.time ? step.time + " — " : ""}${step.action}`);
    }
  } else if (analysis.status === "ok") {
    lines.push("Rien de spécial à organiser — le planning est clair.");
  } else {
    lines.push(analysis.summaryLine);
  }
  const timed = analysis.occurrences
    .filter((o) => !o.allDay && o.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  if (timed.length) {
    lines.push("");
    lines.push("Timeline :");
    for (const o of timed) {
      lines.push(`  ${o.startTime} — ${o.title}`);
    }
  }
  return lines.join("\n");
}

export function simulateWhatIf(
  state: FamilyState,
  date: string,
  changeDescription: string,
): { message: string; analysis: DayCoordination } {
  const analysis = analyzeSingleDay(state, date);
  return {
    message: `Simulation « ${changeDescription} » prise en compte. Voici la nouvelle organisation pour ${analysis.label}.`,
    analysis,
  };
}
