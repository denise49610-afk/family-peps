import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays } from "date-fns";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Folder,
  Heart,
  MapPin,
  Megaphone,
  MessageCircle,
  Plus,
  Settings,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { memberTone, Spark } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { MemberAvatar } from "@/components/member-avatar";
import { AiCoordinatorCard } from "@/components/ai-coordinator-card";
import { detectConflicts, expandRange } from "@/lib/family/expand";
import {
  formatClock,
  formatDayLong,
  relativeDayLabel,
  todayISO,
} from "@/lib/family/dates";
import { useFamilyStore } from "@/lib/family/store";
import type { Occurrence } from "@/lib/family/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const QUICK = [
  {
    to: "/calendrier",
    label: "Agenda",
    sub: "vue famille",
    icon: CalendarDays,
    bg: "bg-tile-purple",
    fg: "text-tile-purple-fg",
  },
  {
    to: "/taches",
    label: "Tâches",
    sub: "à faire",
    icon: ClipboardCheck,
    bg: "bg-tile-pink",
    fg: "text-tile-pink-fg",
  },
  {
    to: "/documents",
    label: "Documents",
    sub: "importants",
    icon: Folder,
    bg: "bg-tile-amber",
    fg: "text-tile-amber-fg",
  },
  {
    to: "/notes",
    label: "Messages",
    sub: "de la famille",
    icon: MessageCircle,
    bg: "bg-tile-mint",
    fg: "text-tile-mint-fg",
  },
] as const;

function Home() {
  const members = useFamilyStore((s) => s.members);
  const events = useFamilyStore((s) => s.events);
  const schedules = useFamilyStore((s) => s.schedules);
  const activities = useFamilyStore((s) => s.activities);
  const tasksAll = useFamilyStore((s) => s.tasks);
  const documents = useFamilyStore((s) => s.documents);
  const categories = useFamilyStore((s) => s.categories);
  const settings = useFamilyStore((s) => s.settings);
  const toggleCompleted = useFamilyStore((s) => s.toggleCompleted);
  const { open } = useEditors();
  const rappelsRef = useRef<HTMLElement | null>(null);
  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);
  const doneKeys = settings.completedKeys ?? [];

  const storeSlice = useMemo(
    () => ({
      settings,
      members,
      events,
      schedules,
      activities,
      tasks: tasksAll,
      documents,
      categories,
      notes: [],
      infos: [],
      contacts: [],
    }),
    [settings, members, events, schedules, activities, tasksAll, documents, categories],
  );

  const occ = useMemo(
    () => expandRange(storeSlice as never, now, addDays(now, 14)),
    [storeSlice, now],
  );
  const todayOcc = occ.filter((o) => o.date === today && o.sourceType !== "schedule");
  const tasks = tasksAll.filter((t) => t.status !== "done");
  // Rappels = uniquement les 7 prochains jours (semaine courante + proche)
  const weekEnd = (() => {
    const d = addDays(now, 6);
    return d.toISOString().slice(0, 10);
  })();
  const upcoming = occ
    .filter((o) => {
      if (o.date < today) return false;
      if (o.date > weekEnd) return false; // hors semaine
      if (doneKeys.includes(o.id)) return false;
      // Aujourd'hui + rappels / événements / activités de la semaine
      return (
        o.reminderMinutes != null ||
        o.sourceType === "event" ||
        o.sourceType === "activity"
      );
    })
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 8);

  const conflicts = useMemo(
    () => detectConflicts(occ.filter((o) => o.date === today)),
    [occ, today],
  );

  const hour = now.getHours();
  const hello = hour < 18 ? "Bonjour" : "Bonsoir";
  const reminderCount = upcoming.length;

  function todoFor(memberId: string) {
    const taskN = tasks.filter((t) => t.assigneeId === memberId).length;
    const eventN = todayOcc.filter(
      (o) => o.memberIds.includes(memberId) && !doneKeys.includes(o.id),
    ).length;
    return taskN + eventN;
  }

  function openOcc(o: Occurrence) {
    if (o.sourceType === "event") open({ type: "event", id: o.sourceId });
    else if (o.sourceType === "activity") open({ type: "activity", id: o.sourceId });
    else if (o.sourceType === "schedule") open({ type: "schedule", id: o.sourceId });
  }

  return (
    <div className="stagger-in flex flex-col gap-4">
      <header className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="relative inline-flex items-center gap-1">
              <Spark className="size-3 text-primary -translate-y-2" />
              <span className="font-script text-[1.5rem] leading-none text-primary">
                {hello}
              </span>
              <Spark className="size-2.5 text-primary/70 translate-y-1" />
              <Spark className="size-2 text-zen-e -translate-y-1" />
            </p>
            <h1 className="mt-0.5 flex items-center gap-2 font-display text-[1.7rem] font-extrabold leading-tight tracking-tight text-ink">
              Toute la famille !
              <Heart className="size-5 fill-primary text-primary" />
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-muted">
              <CalendarDays className="size-3.5" />
              {formatDayLong(now)}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              aria-label="Rappels"
              onClick={() => rappelsRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="relative flex size-12 items-center justify-center rounded-full bg-surface card-shadow"
            >
              <Bell className="size-5 text-ink" />
              {reminderCount > 0 ? (
                <span className="count-badge absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black">
                  {reminderCount > 9 ? "9+" : reminderCount}
                </span>
              ) : null}
            </button>
            <Link
              to="/parametres"
              aria-label="Paramètres"
              className="flex size-12 items-center justify-center rounded-full bg-surface card-shadow"
            >
              <Settings className="size-5 text-ink" />
            </Link>
          </div>
        </div>
      </header>

      <section className={cn("flex gap-2", members.length > 4 && "overflow-x-auto pb-1")}>
        {members.map((m) => {
          const n = todoFor(m.id);
          const ping = todayOcc.some(
            (o) => o.memberIds.includes(m.id) && !doneKeys.includes(o.id),
          );
          return (
            <Link
              key={m.id}
              to="/membre/$memberId"
              params={{ memberId: m.id }}
              className={cn(
                "tap relative flex flex-col items-center rounded-[1.25rem] px-1 pb-2 pt-2.5",
                members.length > 4 ? "w-[4.85rem] shrink-0" : "min-w-0 flex-1",
              )}
              style={{ backgroundColor: memberTone(m.color, "soft") }}
            >
              {ping ? (
                <span
                  className="absolute right-1.5 top-1.5 size-2 rounded-full"
                  style={{ backgroundColor: memberTone(m.color) }}
                />
              ) : null}
              <MemberAvatar member={m} size="lg" plain className="size-[3.25rem]" />
              <span className="mt-1.5 w-full truncate text-center text-[12px] font-extrabold">
                {m.firstName}
              </span>
              <span
                className="mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-white"
                style={{ backgroundColor: memberTone(m.color) }}
              >
                {n} à faire
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => open({ type: "member" })}
          className={cn(
            "tap flex flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed border-line bg-surface px-1 py-2.5 text-muted",
            members.length > 4 ? "w-[4.85rem] shrink-0" : "min-w-0 flex-1",
            members.length === 0 && "max-w-[6.2rem]",
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink">
            <Plus className="size-5" strokeWidth={2.4} />
          </span>
          <span className="mt-1.5 text-center text-[11px] font-extrabold leading-tight text-ink">
            Ajouter
            <span className="block font-bold text-muted">un membre</span>
          </span>
        </button>
      </section>

      <AiCoordinatorCard />

      {conflicts.length > 0 ? (
        <p className="rounded-2xl bg-member-jaune-soft px-4 py-3 text-sm font-bold text-member-jaune-fg">
          {conflicts.length} chevauchement{conflicts.length > 1 ? "s" : ""} aujourd'hui — à
          vérifier dans le planning.
        </p>
      ) : null}

      <section className="relative">
        <Spark className="absolute -left-1 -top-2 size-3 text-primary/80" />
        <Spark className="absolute -right-1 top-1 size-2.5 text-primary/60" />
        <h2 className="mb-2.5 font-display text-[1.05rem] font-extrabold">Accès rapides</h2>
        <div className="grid grid-cols-5 gap-2">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.to}
                to={q.to}
                className={cn(
                  "tap flex min-h-[5.5rem] flex-col items-start rounded-[1.15rem] px-2 py-2",
                  q.bg,
                  q.fg,
                )}
              >
                <Icon className="size-5" strokeWidth={2.2} />
                <span className="mt-auto pt-2 text-[11px] font-extrabold leading-tight text-ink">
                  {q.label}
                  <span className="block font-bold text-ink/55">{q.sub}</span>
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => rappelsRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="tap flex min-h-[5.5rem] flex-col items-start rounded-[1.15rem] bg-tile-lilac px-2 py-2 text-tile-lilac-fg"
          >
            <Megaphone className="size-5" strokeWidth={2.2} />
            <span className="mt-auto pt-2 text-left text-[11px] font-extrabold leading-tight text-ink">
              Rappels
              <span className="block font-bold text-ink/55">& alertes</span>
            </span>
          </button>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="flex shrink-0 items-center gap-1.5 font-display text-[1.15rem] font-extrabold">
            Aujourd'hui
            <Spark className="size-3.5 text-sun" />
          </h2>
          <Link
            to="/calendrier"
            className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-surface px-2.5 py-1.5 text-[11px] font-extrabold text-muted card-shadow"
          >
            Voir le planning complet
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <div className="rounded-[1.5rem] bg-surface px-1.5 py-1.5 card-shadow">
          {todayOcc.length === 0 ? (
            <button
              type="button"
              onClick={() => open({ type: "event", date: today })}
              className="w-full px-3 py-8 text-center text-sm font-semibold text-muted"
            >
              Rien de prévu — ajouter un événement
            </button>
          ) : (
            <ul className="flex flex-col">
              {todayOcc.map((o) => {
                const who =
                  members.find((m) => m.id === o.memberIds[0]) ??
                  members.find((m) => o.memberIds.includes(m.id));
                const color = o.color ?? who?.color ?? "violet";
                const done = doneKeys.includes(o.id);
                const isBell = !done && o.reminderMinutes != null;
                return (
                  <li key={o.id}>
                    <div className="flex items-center gap-2 rounded-[1.1rem] px-1.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => openOcc(o)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className="flex h-8 min-w-[3.15rem] items-center justify-center rounded-xl px-1.5 text-[11px] font-black tabular-nums"
                          style={{
                            backgroundColor: memberTone(color, "soft"),
                            color: memberTone(color, "fg"),
                          }}
                        >
                          {o.allDay ? "Jour" : formatClock(o.startTime)}
                        </span>
                        {who ? (
                          <MemberAvatar member={who} size="sm" plain className="size-9" />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-extrabold leading-tight">
                            {who?.firstName ?? "Famille"}
                          </span>
                          <span className="block truncate text-[12px] font-semibold text-muted">
                            {o.title}
                          </span>
                        </span>
                      </button>
                      {o.location ? (
                        <span
                          className="inline-flex max-w-[7.5rem] items-center gap-0.5 truncate rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                          style={{
                            backgroundColor: memberTone(color, "soft"),
                            color: memberTone(color, "fg"),
                          }}
                        >
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{o.location}</span>
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label={done ? "Marquer non fait" : "Marquer fait"}
                        onClick={() => toggleCompleted(o.id)}
                        className="flex size-8 shrink-0 items-center justify-center"
                      >
                        {done ? (
                          <span
                            className="flex size-6 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: memberTone(color) }}
                          >
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                        ) : isBell ? (
                          <span
                            className="flex size-6 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: memberTone(color, "soft"),
                              color: memberTone(color, "fg"),
                            }}
                          >
                            <Bell className="size-3.5" />
                          </span>
                        ) : (
                          <span className="size-5 rounded-full border-2 border-line" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section
        ref={rappelsRef}
        id="rappels"
        className="scroll-mt-4 rounded-[1.45rem] bg-remind-bg px-3.5 py-3"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-[1.05rem] font-extrabold text-ink">
            <span className="flex size-7 items-center justify-center rounded-full bg-white text-remind-fg">
              <Bell className="size-3.5" />
            </span>
            Rappels à venir
          </h2>
          <Link to="/calendrier" className="text-[12px] font-extrabold text-remind-fg">
            Tout voir
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-3 text-sm font-semibold text-muted">Rien d'urgent pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((o) => (
              <li key={o.id}>
                <div className="flex items-start gap-3 rounded-2xl bg-white px-3 py-2.5">
                  <button
                    type="button"
                    aria-label="Cocher"
                    onClick={() => toggleCompleted(o.id)}
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-line"
                  />
                  <button
                    type="button"
                    onClick={() => openOcc(o)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-[11px] font-bold text-muted">
                      {relativeDayLabel(o.date, now)}
                      {o.startTime ? `  •  ${formatClock(o.startTime)}` : ""}
                    </span>
                    <span className="mt-0.5 block text-[13px] font-extrabold leading-snug">
                      {o.title}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
