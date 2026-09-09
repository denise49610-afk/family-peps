import { useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import {
  coordinateFamily,
  organiseMyDay,
  whatShouldWeDo,
  type DayCoordination,
  type RankedSolution,
} from "@/lib/family/coordinator";
import { useFamilyStore } from "@/lib/family/store";
import { todayISO } from "@/lib/family/dates";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/member-avatar";

function statusStyles(status: DayCoordination["status"]) {
  if (status === "ok") {
    return {
      bg: "bg-emerald-50 border-emerald-200",
      badge: "bg-emerald-500 text-white",
      icon: CheckCircle2,
      label: "Tout va bien",
    };
  }
  if (status === "needs-org") {
    return {
      bg: "bg-amber-50 border-amber-200",
      badge: "bg-amber-500 text-white",
      icon: Lightbulb,
      label: "Organisation nécessaire",
    };
  }
  return {
    bg: "bg-rose-50 border-rose-200",
    badge: "bg-rose-500 text-white",
    icon: AlertTriangle,
    label: "Conflit détecté",
  };
}

function SolutionCard({
  sol,
  members,
}: {
  sol: RankedSolution;
  members: ReturnType<typeof useFamilyStore.getState>["members"];
}) {
  const medal = sol.rank === 1 ? "🥇" : sol.rank === 2 ? "🥈" : sol.rank === 3 ? "🥉" : "•";
  const actor = sol.steps[0]?.actorId
    ? members.find((m) => m.id === sol.steps[0].actorId)
    : null;
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="text-lg">{medal}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-ink">{sol.title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink/80">{sol.summary}</p>
          {sol.steps.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {sol.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-[11px] font-semibold text-ink/70">
                  <span className="tabular-nums text-primary">{s.time || "•"}</span>
                  <span>
                    {s.action}
                    {s.detail ? ` — ${s.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {actor ? (
            <div className="mt-2 flex items-center gap-1.5">
              <MemberAvatar member={actor} size="xs" />
              <span className="text-[11px] font-bold text-muted">{actor.firstName}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AiCoordinatorCard() {
  const members = useFamilyStore((s) => s.members);
  const events = useFamilyStore((s) => s.events);
  const activities = useFamilyStore((s) => s.activities);
  const schedules = useFamilyStore((s) => s.schedules);
  const tasks = useFamilyStore((s) => s.tasks);
  const settings = useFamilyStore((s) => s.settings);
  const categories = useFamilyStore((s) => s.categories);
  const documents = useFamilyStore((s) => s.documents);
  const notes = useFamilyStore((s) => s.notes);
  const infos = useFamilyStore((s) => s.infos);
  const contacts = useFamilyStore((s) => s.contacts);

  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"suggest" | "organise" | "simple">("suggest");

  const state = useMemo(
    () => ({
      settings,
      members,
      events,
      activities,
      schedules,
      tasks,
      documents,
      notes,
      infos,
      contacts,
      categories,
    }),
    [settings, members, events, activities, schedules, tasks, documents, notes, infos, contacts, categories],
  );

  const result = useMemo(() => coordinateFamily(state, { days: 3 }), [state]);
  const todayAnalysis = result.days[0];
  const organised = useMemo(() => organiseMyDay(state, todayISO()), [state]);
  const simple = useMemo(() => whatShouldWeDo(state, todayISO()), [state]);

  const styles = statusStyles(result.overallStatus);
  const StatusIcon = styles.icon;

  return (
    <section
      className={cn(
        "rounded-[1.5rem] border px-4 py-3 shadow-sm",
        styles.bg,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Brain className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-[15px] font-extrabold text-ink">
              Assistant famille
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                styles.badge,
              )}
            >
              <StatusIcon className="size-3" />
              {styles.label}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink/80">{result.headline}</p>
          {todayAnalysis?.best && todayAnalysis.status !== "ok" ? (
            <p className="mt-1.5 text-[12px] font-semibold text-ink">
              🧠 {todayAnalysis.best.title}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("suggest");
            setExpanded((v) => !v);
          }}
          className="tap inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold text-ink shadow-sm"
        >
          <Sparkles className="size-3.5 text-primary" />
          {expanded && mode === "suggest" ? "Masquer" : "Voir la solution"}
          {expanded && mode === "suggest" ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("organise");
            setExpanded(true);
          }}
          className="tap inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-extrabold text-primary"
        >
          ✨ Organise ma journée
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("simple");
            setExpanded(true);
          }}
          className="tap inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-[12px] font-extrabold text-ink"
        >
          Que doit-on faire ?
        </button>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3">
          {mode === "suggest" && todayAnalysis ? (
            <>
              {todayAnalysis.problems.length > 0 ? (
                <ul className="space-y-1.5">
                  {todayAnalysis.problems.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl bg-white/80 px-3 py-2 text-[12px] font-semibold text-ink"
                    >
                      <span className="font-extrabold">{p.title}</span>
                      <span className="mt-0.5 block font-medium text-ink/70">
                        {p.description}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] font-semibold text-ink/70">
                  Aucun problème détecté pour aujourd'hui.
                </p>
              )}
              {todayAnalysis.solutions.map((sol) => (
                <SolutionCard key={sol.id} sol={sol} members={members} />
              ))}
            </>
          ) : null}

          {mode === "organise" ? (
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[13px] font-extrabold text-ink">{organised.title}</p>
              <p className="mt-1 text-[12px] font-semibold text-primary">
                {organised.recommendation}
              </p>
              <p className="mt-1 text-[11px] text-ink/60">{organised.why}</p>
              {organised.timeline.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-2">
                  {organised.timeline.map((row, i) => (
                    <li key={i} className="flex gap-2 text-[12px]">
                      <span className="w-12 shrink-0 font-black tabular-nums text-primary">
                        {row.time}
                      </span>
                      <span className="min-w-0">
                        <span className="font-extrabold text-ink">{row.what}</span>
                        <span className="block text-[11px] font-semibold text-muted">
                          {row.who}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-muted">
                  Aucun créneau horaire aujourd'hui. Ajoute tes RDV dans le calendrier pour que
                  je t'organise la journée.
                </p>
              )}
            </div>
          ) : null}

          {mode === "simple" ? (
            <pre className="whitespace-pre-wrap rounded-2xl bg-white p-3 text-[12px] font-semibold leading-relaxed text-ink shadow-sm">
              {simple}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
