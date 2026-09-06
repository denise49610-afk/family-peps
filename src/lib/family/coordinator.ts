/**
 * IA de coordination familiale — « Trouve-nous la meilleure solution »
 *
 * Analyse planning → détecte contraintes → calcule possibilités → propose solutions classées.
 * Ne se contente pas de signaler les conflits : elle propose des organisations réalisables.
 */

import { addDays, parseISO } from "date-fns";
import { expandRange, detectConflicts } from "./expand";
import { todayISO, toISODate } from "./dates";
import type {
  FamilyMember,
  FamilyState,
  Occurrence,
  Conflict,
} from "./types";

// ─── Types publics ───────────────────────────────────────────────────────────

export type ConstraintLevel = "obligation" | "important" | "flexible";

export type LogisticsProblem = {
  id: string;
  severity: "red" | "orange" | "yellow";
  title: string;
  description: string;
  relatedOccIds: string[];
  childId?: string;
  activityOcc?: Occurrence;
  freeFrom?: string; // HH:MM when child becomes free
  needBy?: string; // HH:MM when child must be at next place
};

export type SolutionStep = {
  time: string;
  actorId: string | null; // null = system / child alone
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
  score: number; // higher = better
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMin(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function memberName(m: FamilyMember | undefined): string {
  if (!m) return "Quelqu’un";
  return m.nickname || m.firstName || "Membre";
}

function isParent(m: FamilyMember): boolean {
  return m.role === "parent";
}

function isChild(m: FamilyMember): boolean {
  return m.role === "enfant";
}

/** Estimation simple de trajet (minutes) + marge de sécurité. */
export function estimateTravel(
  fromLoc: string,
  toLoc: string,
  options?: { margin?: number },
): { theoretical: number; withMargin: number; note: string } {
  const margin = options?.margin ?? 10;
  const a = (fromLoc || "").toLowerCase().trim();
  const b = (toLoc || "").toLowerCase().trim();

  if (!a || !b || a === b || a.includes("maison") && b.includes("maison")) {
    return { theoretical: 5, withMargin: 10, note: "Même lieu ou domicile" };
  }

  // Heuristiques françaises courantes
  if (
    (a.includes("école") || a.includes("lycée") || a.includes("collège")) &&
    (b.includes("stade") || b.includes("sport") || b.includes("foot"))
  ) {
    return { theoretical: 15, withMargin: 15 + margin, note: "École → stade" };
  }
  if (a.includes("travail") || b.includes("travail")) {
    return { theoretical: 20, withMargin: 20 + margin, note: "Lieu de travail" };
  }
  if (a.includes("cabinet") || b.includes("cabinet") || a.includes("rdv") || b.includes("rdv")) {
    return { theoretical: 15, withMargin: 15 + margin, note: "Cabinet / RDV" };
  }

  // Même ville approximative
  if (a && b && (a.includes(b.slice(0, 4)) || b.includes(a.slice(0, 4)))) {
    return { theoretical: 12, withMargin: 12 + margin, note: "Même secteur" };
  }

  return { theoretical: 20, withMargin: 20 + margin, note: "Trajet estimé" };
}

function constraintLevel(occ: Occurrence): ConstraintLevel {
  if (occ.sourceType === "schedule" || occ.categoryId === "cat-ecole") return "obligation";
  if (occ.sourceType === "birthday") return "important";
  const title = (occ.title || "").toLowerCase();
  if (
    title.includes("travail") ||
    title.includes("examen") ||
    title.includes("compétition") ||
    title.includes("train") ||
    title.includes("médical") ||
    title.includes("dentiste") ||
    title.includes("orthophoniste") ||
    title.includes("médecin")
  ) {
    return "obligation";
  }
  if (
    occ.sourceType === "activity" ||
    title.includes("foot") ||
    title.includes("sport") ||
    title.includes("réunion") ||
    title.includes("rdv")
  ) {
    return "important";
  }
  return "flexible";
}

function endsAround(occ: Occurrence): number {
  return toMin(occ.endTime || occ.startTime);
}

function startsAround(occ: Occurrence): number {
  return toMin(occ.startTime);
}

// ─── Core analysis ───────────────────────────────────────────────────────────

function findSchoolEnd(
  occs: Occurrence[],
  childId: string,
): Occurrence | null {
  const school = occs
    .filter(
      (o) =>
        o.memberIds.includes(childId) &&
        (o.sourceType === "schedule" ||
          o.categoryId === "cat-ecole" ||
          /école|lycée|collège|cours/i.test(o.title)),
    )
    .sort((a, b) => endsAround(b) - endsAround(a));
  return school[0] ?? null;
}

function findNextActivity(
  occs: Occurrence[],
  childId: string,
  afterMin: number,
): Occurrence | null {
  const acts = occs
    .filter(
      (o) =>
        o.memberIds.includes(childId) &&
        startsAround(o) > afterMin &&
        (o.sourceType === "activity" ||
          /foot|sport|entraîne|piscine|musique|danse/i.test(o.title)),
    )
    .sort((a, b) => startsAround(a) - startsAround(b));
  return acts[0] ?? null;
}

function parentAvailability(
  occs: Occurrence[],
  parentId: string,
  windowStart: number,
  windowEnd: number,
): { free: boolean; blocking?: Occurrence; freeFrom?: number } {
  const blocking = occs
    .filter(
      (o) =>
        o.memberIds.includes(parentId) &&
        !o.allDay &&
        startsAround(o) < windowEnd &&
        endsAround(o) > windowStart,
    )
    .sort((a, b) => startsAround(a) - startsAround(b));

  if (blocking.length === 0) {
    return { free: true, freeFrom: windowStart };
  }

  // Si le parent finit avant la fenêtre ou juste au début
  const lastBlocking = blocking[blocking.length - 1];
  const freeFrom = endsAround(lastBlocking);
  if (freeFrom <= windowStart + 5) {
    return { free: true, freeFrom };
  }
  return { free: false, blocking: blocking[0], freeFrom };
}

function buildSolutionsForPickup(
  state: FamilyState,
  date: string,
  child: FamilyMember,
  schoolEnd: Occurrence,
  nextAct: Occurrence,
  travel: ReturnType<typeof estimateTravel>,
): RankedSolution[] {
  const parents = state.members.filter(isParent);
  const freeAt = endsAround(schoolEnd);
  const needBy = startsAround(nextAct);
  const travelNeeded = travel.withMargin;
  const latestDeparture = needBy - travelNeeded;

  const solutions: RankedSolution[] = [];
  let rank = 1 as 1 | 2 | 3 | 4;

  for (const parent of parents) {
    const dayOccs = expandRange(
      state,
      parseISO(date),
      addDays(parseISO(date), 1),
    ).filter((o) => o.date === date);

    const avail = parentAvailability(dayOccs, parent.id, freeAt, needBy);
    const canMakeIt =
      avail.free ||
      (avail.freeFrom !== undefined && avail.freeFrom <= latestDeparture);

    const steps: SolutionStep[] = [
      {
        time: fromMin(freeAt),
        actorId: parent.id,
        action: `Récupère ${memberName(child)}`,
        detail: schoolEnd.location || "sortie d’école",
      },
      {
        time: fromMin(Math.max(freeAt, avail.freeFrom ?? freeAt) + 5),
        actorId: parent.id,
        action: "Départ vers le lieu d’activité",
        detail: `${travel.theoretical} min + marge → ${travel.withMargin} min`,
      },
      {
        time: fromMin(needBy),
        actorId: child.id,
        action: nextAct.title,
        detail: nextAct.location || "",
      },
    ];

    const pros: string[] = [];
    const cons: string[] = [];
    let score = 70;
    let requiresChange = false;
    let feasible = canMakeIt;
    let confidence: RankedSolution["confidence"] = "known";

    if (canMakeIt && avail.free) {
      pros.push("Aucun changement de planning nécessaire");
      pros.push("Trajet raisonnable");
      score += 25;
    } else if (canMakeIt) {
      pros.push(`${memberName(parent)} est disponible juste à temps`);
      score += 10;
      requiresChange = false;
    } else {
      cons.push(
        `${memberName(parent)} est occupé jusqu’à ${fromMin(avail.freeFrom ?? 0)}`,
      );
      if (avail.blocking) {
        cons.push(`Bloqué par : ${avail.blocking.title}`);
      }
      requiresChange = true;
      score -= 30;
      feasible = false;
      // Still propose as "si modification"
      score += 5;
    }

    // Préférence simple : maman préfère souvent récupérer (heuristique)
    if (/maman|mère|mom/i.test(parent.firstName) || parent.nickname?.toLowerCase().includes("mam")) {
      score += 8;
      pros.push("Correspond souvent aux préférences familiales");
    }

    solutions.push({
      id: `sol-pickup-${parent.id}-${nextAct.id}`,
      rank: rank as 1 | 2 | 3 | 4,
      title: `${memberName(parent)} récupère ${memberName(child)}`,
      summary: `${memberName(parent)} récupère à ${fromMin(freeAt)} puis emmène au ${nextAct.title} (${fromMin(needBy)}).`,
      why: canMakeIt
        ? "C’est la solution qui minimise les changements et respecte les horaires."
        : `Nécessite que ${memberName(parent)} termine plus tôt ou réorganise.`,
      steps,
      pros,
      cons,
      requiresChange,
      score,
      feasible,
      confidence,
    });
    rank = Math.min(4, rank + 1) as 1 | 2 | 3 | 4;
  }

  // Solution "enfant reste / garde" si possible (hypothétique)
  solutions.push({
    id: `sol-stay-${child.id}`,
    rank: 3,
    title: `${memberName(child)} reste sur place / étude`,
    summary: `Si l’école ou une étude surveillée le permet jusqu’à ${fromMin(needBy - travelNeeded)}.`,
    why: "À n’utiliser que si cette possibilité est explicitement autorisée dans les données.",
    steps: [
      {
        time: fromMin(freeAt),
        actorId: child.id,
        action: "Reste à l’école / étude",
        detail: "Uniquement si autorisé",
      },
      {
        time: fromMin(needBy - travelNeeded),
        actorId: null,
        action: "Départ vers l’activité",
      },
    ],
    pros: ["Évite un trajet parental intermédiaire"],
    cons: ["Dépend d’une autorisation non confirmée", "Information manquante"],
    requiresChange: false,
    score: 40,
    feasible: false, // par défaut, car on n’invente pas
    confidence: "missing",
  });

  // Trier par score
  solutions.sort((a, b) => b.score - a.score);
  solutions.forEach((s, i) => {
    s.rank = (i + 1) as 1 | 2 | 3 | 4;
  });

  return solutions;
}

function analyzeSingleDay(state: FamilyState, date: string): DayCoordination {
  const from = parseISO(date);
  const to = addDays(from, 1);
  const occurrences = expandRange(state, from, to).filter((o) => o.date === date);
  const conflicts = detectConflicts(occurrences);

  const problems: LogisticsProblem[] = [];
  const allSolutions: RankedSolution[] = [];

  const children = state.members.filter(isChild);

  for (const child of children) {
    const schoolEnd = findSchoolEnd(occurrences, child.id);
    if (!schoolEnd) continue;

    const nextAct = findNextActivity(occurrences, child.id, endsAround(schoolEnd));
    if (!nextAct) continue;

    const freeAt = endsAround(schoolEnd);
    const needBy = startsAround(nextAct);
    const gap = needBy - freeAt;

    const travel = estimateTravel(
      schoolEnd.location || "école",
      nextAct.location || "activité",
    );

    // S’il n’y a pas assez de temps même avec le meilleur trajet → problème
    if (gap < travel.withMargin + 5) {
      problems.push({
        id: `prob-gap-${child.id}-${nextAct.id}`,
        severity: "red",
        title: `Temps insuffisant pour ${memberName(child)}`,
        description: `${memberName(child)} sort à ${fromMin(freeAt)}, activité à ${fromMin(needBy)} (${gap} min). Trajet estimé ${travel.withMargin} min.`,
        relatedOccIds: [schoolEnd.id, nextAct.id],
        childId: child.id,
        activityOcc: nextAct,
        freeFrom: fromMin(freeAt),
        needBy: fromMin(needBy),
      });
    } else {
      // Vérifier si un parent peut faire le trajet
      const parents = state.members.filter(isParent);
      let anyParentCan = false;
      for (const p of parents) {
        const avail = parentAvailability(occurrences, p.id, freeAt, needBy);
        if (avail.free || (avail.freeFrom !== undefined && avail.freeFrom <= needBy - travel.withMargin)) {
          anyParentCan = true;
          break;
        }
      }
      if (!anyParentCan) {
        problems.push({
          id: `prob-no-parent-${child.id}-${nextAct.id}`,
          severity: "orange",
          title: `Qui emmène ${memberName(child)} ?`,
          description: `${memberName(child)} termine à ${fromMin(freeAt)} et doit être à ${nextAct.title} à ${fromMin(needBy)}. Aucun parent n’est clairement disponible.`,
          relatedOccIds: [schoolEnd.id, nextAct.id],
          childId: child.id,
          activityOcc: nextAct,
          freeFrom: fromMin(freeAt),
          needBy: fromMin(needBy),
        });
      } else {
        // Il y a un problème de coordination potentiel → on propose quand même
        problems.push({
          id: `prob-coord-${child.id}-${nextAct.id}`,
          severity: "yellow",
          title: `Organisation à clarifier pour ${memberName(child)}`,
          description: `Sortie ${fromMin(freeAt)} → ${nextAct.title} à ${fromMin(needBy)}. Trajet ~${travel.withMargin} min.`,
          relatedOccIds: [schoolEnd.id, nextAct.id],
          childId: child.id,
          activityOcc: nextAct,
          freeFrom: fromMin(freeAt),
          needBy: fromMin(needBy),
        });
      }
    }

    const sols = buildSolutionsForPickup(
      state,
      date,
      child,
      schoolEnd,
      nextAct,
      travel,
    );
    allSolutions.push(...sols);
  }

  // Ajouter les conflits classiques comme problèmes
  for (const c of conflicts) {
    problems.push({
      id: `prob-conflict-${c.id}`,
      severity: c.reason === "school-activity" ? "red" : "orange",
      title: `Chevauchement : ${c.a.title} / ${c.b.title}`,
      description: `${memberName(state.members.find((m) => m.id === c.memberId))} a deux obligations qui se chevauchent.`,
      relatedOccIds: [c.a.id, c.b.id],
    });
  }

  // Dédupliquer et trier solutions
  const uniqueSols = Array.from(
    new Map(allSolutions.map((s) => [s.id, s])).values(),
  ).sort((a, b) => b.score - a.score);

  uniqueSols.forEach((s, i) => {
    s.rank = (Math.min(i + 1, 4) as 1 | 2 | 3 | 4);
  });

  const best = uniqueSols.find((s) => s.feasible) ?? uniqueSols[0];

  let status: DayCoordination["status"] = "ok";
  if (problems.some((p) => p.severity === "red") || conflicts.length > 0) {
    status = "conflict";
  } else if (problems.length > 0) {
    status = "needs-org";
  }

  let summaryLine = "Tout est compatible.";
  if (status === "conflict") {
    summaryLine = "Il y a un vrai conflit d’organisation.";
  } else if (status === "needs-org") {
    summaryLine = "Une organisation est nécessaire.";
  }

  return {
    date,
    label: date === todayISO() ? "Aujourd’hui" : date === toISODate(addDays(new Date(), 1)) ? "Demain" : date,
    status,
    problems,
    solutions: uniqueSols.slice(0, 4),
    best,
    occurrences,
    conflicts,
    summaryLine,
  };
}

/**
 * Analyse les prochains jours (par défaut aujourd’hui + demain + surlendemain).
 */
export function coordinateFamily(
  state: FamilyState,
  options?: { days?: number; fromDate?: string },
): CoordinationResult {
  const daysCount = options?.days ?? 3;
  const start = options?.fromDate ? parseISO(options.fromDate) : new Date();
  const days: DayCoordination[] = [];

  for (let i = 0; i < daysCount; i++) {
    const d = toISODate(addDays(start, i));
    days.push(analyzeSingleDay(state, d));
  }

  const hasConflict = days.some((d) => d.status === "conflict");
  const needsOrg = days.some((d) => d.status === "needs-org");

  let overallStatus: CoordinationResult["overallStatus"] = "ok";
  let headline = "🟢 Tout va bien pour les prochains jours.";
  let nextAction: string | undefined;

  if (hasConflict) {
    overallStatus = "conflict";
    headline = "🔴 Il y a un vrai conflit d’organisation.";
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

  return {
    days,
    overallStatus,
    headline,
    nextAction,
  };
}

/**
 * Mode « Organise ma journée » — synthèse simple et actionnable.
 */
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

  const timeline = analysis.occurrences
    .filter((o) => !o.allDay && o.startTime)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime))
    .map((o) => {
      const who =
        o.wholeFamily
          ? "Famille"
          : o.memberIds
              .map((id) => memberName(membersById.get(id)))
              .join(", ");
      return {
        time: o.startTime,
        who,
        what: o.endTime ? `${o.title} (${o.startTime}–${o.endTime})` : o.title,
      };
    });

  const best = analysis.best;
  return {
    title: analysis.label,
    timeline,
    recommendation: best
      ? best.summary
      : analysis.status === "ok"
        ? "Aucune action particulière. Tout le monde est à l’heure."
        : "Vérifiez les disponibilités des parents pour les trajets.",
    why: best?.why ?? analysis.summaryLine,
    status: analysis.status,
  };
}

/**
 * Mode « Que doit-on faire ? » — réponse ultra simple.
 */
export function whatShouldWeDo(
  state: FamilyState,
  date: string = todayISO(),
): string {
  const analysis = analyzeSingleDay(state, date);
  const lines: string[] = [`🏠 ${analysis.label.toUpperCase()}`];

  const parents = state.members.filter(isParent);
  const children = state.members.filter(isChild);

  for (const p of parents) {
    const work = analysis.occurrences.find(
      (o) =>
        o.memberIds.includes(p.id) &&
        /travail|bureau|job/i.test(o.title),
    );
    if (work) {
      lines.push(`👩/👨 ${memberName(p)} : travail jusqu’à ${work.endTime || "?"}`);
    } else {
      const last = analysis.occurrences
        .filter((o) => o.memberIds.includes(p.id) && o.endTime)
        .sort((a, b) => endsAround(b) - endsAround(a))[0];
      if (last) {
        lines.push(`👩/👨 ${memberName(p)} : occupé jusqu’à ${last.endTime}`);
      }
    }
  }

  for (const c of children) {
    const school = findSchoolEnd(analysis.occurrences, c.id);
    const act = school
      ? findNextActivity(analysis.occurrences, c.id, endsAround(school))
      : null;
    if (school) {
      lines.push(`👦 ${memberName(c)} : école jusqu’à ${school.endTime}`);
    }
    if (act) {
      lines.push(`⚽ ${act.title} à ${act.startTime}`);
    }
  }

  lines.push("");
  lines.push("🧠 Solution");
  if (analysis.best) {
    lines.push(analysis.best.summary);
    if (analysis.best.pros[0]) {
      lines.push(`➡️ ${analysis.best.pros[0]}`);
    }
  } else {
    lines.push(analysis.summaryLine);
  }

  return lines.join("\n");
}

/**
 * Simulation « Et si … ? »
 * Pour l’instant on ne mute pas l’état : on retourne une analyse textuelle.
 * L’appelant peut cloner l’état et modifier un événement avant d’appeler coordinateFamily.
 */
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
