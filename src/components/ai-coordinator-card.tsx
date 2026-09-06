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
  compact,
}: {
  sol: RankedSolution;
  members: ReturnType<typeof useFamilyStore.getState>["members"];
  compact?: boolean;
}) {
  const medal = sol.rank === 1 ? "🥇" : sol.rank === 2 ? "🥈" : sol.rank === 3 ? "🥉" : "•";
  const actor = sol.steps[0]?.actorId
    ? members.find((m) => m.id === sol.steps[0].actorId)
    : null;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-3.5 shadow-sm",
        sol.rank === 1 && "border-primary/30 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">{medal}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-ink">{sol.title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">{sol.summary}</p>
        </div>
        {actor ? <MemberAvatar member={actor} size="sm" plain className="size-8 shrink-0" /> : null}
      </div>

      {!compact && sol.steps.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-2.5">
          {sol.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-[12px]">
              <span className="w-11 shrink-0 font-bold tabular-nums text-primary">
                {s.time}
              </span>
              <span className="text-ink">
                {s.action}
                {s.detail ? (
                  <span className="text-muted"> · {s.detail}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-muted">
        <Brain className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>
          <span className="font-bold text-ink">Pourquoi ? </span>
          {sol.why}
        </span>
      </p>

      {sol.pros.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {sol.pros.map((p) => (
            <li
              key={p}
              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
            >
              ✅ {p}
            </li>
          ))}
        </ul>
      ) : null}
      {sol.cons.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {sol.cons.map((c) => (
            <li
              key={c}
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
            >
              ⚠️ {c}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AiCoordinatorCard() {
  const members = useFamilyStore((s) => s.members);
  const events = useFamilyStore((s) => s.events);
  const schedules = useFamilyStore((s) => s.schedules);
  const activities = useFamilyStore((s) => s.activities);
  const tasks = useFamilyStore((s) => s.tasks);
  const settings = useFamilyStore((s) => s.settings);
  const categories = useFamilyStore((s) => s.categories);
  const documents = useFamilyStore((s) => s.documents);

  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"suggest" | "organise" | "simple">("suggest");

  const state = useMemo(
    () => ({
      settings,
      members,
      events,
      schedules,
      activities,
      tasks,
      documents,
      notes: [],
      infos: [],
      contacts: [],
      categories,
    }),
    [settings, members, events, schedules, activities, tasks, documents, categories],
  );

  const result = useMemo(() => coordinateFamily(state, { days: 2 }), [state]);
  const todayAnalysis = result.days[0];
  const styles = statusStyles(todayAnalysis?.status ?? "ok");
  const StatusIcon = styles.icon;

  const organised = useMemo(
    () => (mode === "organise" ? organiseMyDay(state) : null),
    [mode, state],
  );
  const simpleText = useMemo(
    () => (mode === "simple" ? whatShouldWeDo(state) : null),
    [mode, state],
  );

  if (members.length === 0) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border p-4 card-shadow",
        styles.bg,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Brain className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-[15px] font-extrabold text-ink">
              J’ai analysé votre journée
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
          <p className="mt-1 text-[13px] leading-snug text-ink/80">
            {result.headline}
          </p>
          {todayAnalysis?.best && todayAnalysis.status !== "ok" ? (
            <p className="mt-1.5 text-[12px] font-semibold text-ink">
              🧠 {todayAnalysis.best.title}
            </p>
          ) : null}
        </div>
      </div>

      {/* Actions */}
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
                <div className="rounded-2xl border border-black/5 bg-white/70 p-3">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-muted">
                    Problèmes détectés
                  </p>
                  <ul className="space-y-2">
                    {todayAnalysis.problems.map((p) => (
                      <li key={p.id} className="flex gap-2 text-[12px]">
                        <span>
                          {p.severity === "red"
                            ? "🔴"
                            : p.severity === "orange"
                              ? "🟠"
                              : "🟡"}
                        </span>
                        <div>
                          <p className="font-bold text-ink">{p.title}</p>
                          <p className="text-muted">{p.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {todayAnalysis.solutions.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">
                    Solutions proposées
                  </p>
                  {todayAnalysis.solutions.map((sol) => (
                    <SolutionCard key={sol.id} sol={sol} members={members} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-white/80 p-3 text-[13px] text-ink">
                  Aucune organisation particulière à proposer. Tout le monde peut suivre son
                  planning habituel.
                </p>
              )}
            </>
          ) : null}

          {mode === "organise" && organised ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-black/5 bg-white p-3.5">
                <p className="font-display text-[15px] font-extrabold text-ink">
                  🏠 {organised.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {organised.timeline.slice(0, 12).map((row, i) => (
                    <li key={i} className="flex gap-2 text-[12px]">
                      <span className="w-11 shrink-0 font-bold tabular-nums text-primary">
                        {row.time}
                      </span>
                      <span className="min-w-0">
                        <span className="font-semibold text-ink">{row.who}</span>
                        <span className="text-muted"> — {row.what}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-black text-primary">
                  <Brain className="size-3.5" /> Organisation recommandée
                </p>
                <p className="mt-1 text-[13px] font-semibold text-ink">
                  {organised.recommendation}
                </p>
                <p className="mt-1.5 text-[12px] text-muted">{organised.why}</p>
              </div>
            </div>
          ) : null}

          {mode === "simple" && simpleText ? (
            <pre className="whitespace-pre-wrap rounded-2xl border border-black/5 bg-white p-3.5 font-sans text-[13px] leading-relaxed text-ink">
              {simpleText}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
