import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays } from "date-fns";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { memberTone } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { MemberAvatar } from "@/components/member-avatar";
import { openMoreMenu } from "@/components/shell";
import { ShareFamilyCard } from "@/components/share-family";
import { detectConflicts, expandRange, reminderLabel } from "@/lib/family/expand";
import { formatDayLong, formatTime, todayISO } from "@/lib/family/dates";
import { useFamilyStore } from "@/lib/family/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const settings = useFamilyStore((s) => s.settings);
  const members = useFamilyStore((s) => s.members);
  const events = useFamilyStore((s) => s.events);
  const schedules = useFamilyStore((s) => s.schedules);
  const activities = useFamilyStore((s) => s.activities);
  const tasksAll = useFamilyStore((s) => s.tasks);
  const documents = useFamilyStore((s) => s.documents);
  const notes = useFamilyStore((s) => s.notes);
  const categories = useFamilyStore((s) => s.categories);
  const { open } = useEditors();
  const [familyOpen, setFamilyOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);

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
  const tasks = tasksAll
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const reminders = occ
    .map((o) => ({ o, label: reminderLabel(o, now) }))
    .filter((x) => x.label);
  const nextReminder = reminders[0];
  const docs = [...documents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const lastNote = [...notes]
    .filter((n) => n.visibility !== "personal")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const lastWho = members.find((m) => m.id === lastNote?.memberId);
  const conflicts = useMemo(
    () => detectConflicts(occ.filter((o) => o.date === today)),
    [occ, today],
  );

  const rawName =
    (settings.familyName && settings.familyName.trim()) ||
    members.map((m) => m.lastName.trim()).find((n) => n.length > 1) ||
    "Ma famille";
  const familyName = rawName;
  const hour = now.getHours();
  const hello = hour < 18 ? "Bonjour" : "Bonsoir";
  const vibe =
    hour < 12
      ? "Une belle journée commence"
      : hour < 18
        ? "On avance ensemble"
        : "Douce soirée en famille";

  return (
    <div className="stagger-in flex flex-col gap-6">
      <header className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[1.85rem] font-extrabold leading-tight tracking-tight">
              {hello}{" "}
              <span aria-hidden className="inline-block origin-bottom-right">
                👋
              </span>
            </h1>
            <button
              type="button"
              onClick={() => setFamilyOpen((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-muted"
            >
              Toute la famille
              <ChevronDown className={cn("size-4 transition", familyOpen && "rotate-180")} />
            </button>
            <p className="mt-0.5 text-xs font-semibold text-faint">{vibe}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Rappels"
              onClick={() => setBellOpen((v) => !v)}
              className="relative flex size-11 items-center justify-center rounded-full bg-surface card-shadow"
            >
              <Bell className="size-5" />
              {reminders.length > 0 ? (
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-primary" />
              ) : null}
            </button>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => openMoreMenu()}
              className="flex size-11 items-center justify-center rounded-full bg-surface card-shadow lg:hidden"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        </div>

        {familyOpen ? (
          <div className="absolute left-0 z-20 mt-2 w-56 rounded-2xl bg-surface p-2 card-shadow">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">
              Famille {familyName}
            </p>
            <Link
              to="/famille"
              onClick={() => setFamilyOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-surface-2"
            >
              Voir tout le monde
            </Link>
            {members.map((m) => (
              <Link
                key={m.id}
                to="/membre/$memberId"
                params={{ memberId: m.id }}
                onClick={() => setFamilyOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold hover:bg-surface-2"
              >
                <MemberAvatar member={m} size="xs" />
                {m.firstName}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-4 gap-x-2 gap-y-4">
        {members.map((m) => (
          <Link
            key={m.id}
            to="/membre/$memberId"
            params={{ memberId: m.id }}
            className="tap flex min-w-0 flex-col items-center gap-1.5"
          >
            <MemberAvatar member={m} size="lg" className="shadow-card" />
            <span className="w-full truncate text-center text-xs font-extrabold leading-tight">
              {m.firstName}
            </span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => open({ type: "member" })}
          className="tap flex min-w-0 flex-col items-center gap-1.5 text-muted"
        >
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-line bg-surface text-2xl font-bold">
            +
          </span>
          <span className="w-full truncate text-center text-xs font-extrabold leading-tight">
            Ajouter
          </span>
        </button>
      </div>
      <p className="-mt-3 text-xs font-semibold text-muted">
        Touchez une photo pour voir le planning de chacun
      </p>

      <ShareFamilyCard compact />

      {conflicts.length > 0 ? (
        <p className="rounded-2xl bg-member-jaune-soft px-4 py-3 text-sm font-bold text-member-jaune-fg">
          {conflicts.length} chevauchement{conflicts.length > 1 ? "s" : ""} aujourd'hui —
          à vérifier dans le planning.
        </p>
      ) : null}

      {bellOpen ? (
        <section className="rounded-[1.6rem] bg-surface p-4 card-shadow">
          <p className="mb-2 font-display text-base font-extrabold">Rappels</p>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted">Rien d'urgent pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {reminders.slice(0, 4).map((r) => (
                <li key={r.o.id} className="text-sm font-semibold">
                  {r.label}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-xl font-extrabold">Aujourd'hui</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/calendrier"
            className="tap rounded-[1.5rem] bg-surface px-4 py-4 card-shadow"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-member-violet-soft text-member-violet">
              <CalendarDays className="size-5" />
            </span>
            <p className="mt-3 font-display text-2xl font-extrabold tabular-nums leading-none">
              {todayOcc.length}
            </p>
            <p className="mt-1 text-sm font-bold text-muted">
              événement{todayOcc.length > 1 ? "s" : ""} à venir
            </p>
          </Link>
          <Link
            to="/taches"
            className="tap rounded-[1.5rem] bg-surface px-4 py-4 card-shadow"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-member-vert-soft text-member-vert">
              <CheckCircle2 className="size-5" />
            </span>
            <p className="mt-3 font-display text-2xl font-extrabold tabular-nums leading-none">
              {tasks.length}
            </p>
            <p className="mt-1 text-sm font-bold text-muted">
              tâche{tasks.length > 1 ? "s" : ""} en attente
            </p>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-extrabold">Prochain rappel</h2>
        {nextReminder ? (
          <Link
            to="/calendrier"
            className="tap flex items-center gap-3 rounded-[1.5rem] bg-member-jaune-soft px-4 py-4"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-member-jaune-fg card-shadow">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-extrabold">{nextReminder.o.title}</p>
              <p className="text-sm font-semibold text-member-jaune-fg/80">
                {nextReminder.o.memberIds
                  .map((id) => members.find((m) => m.id === id)?.firstName)
                  .filter(Boolean)
                  .join(", ") || "Famille"}
                {nextReminder.o.startTime
                  ? ` · Aujourd'hui à ${formatTime(nextReminder.o.startTime)}`
                  : ""}
              </p>
            </div>
          </Link>
        ) : (
          <p className="rounded-[1.5rem] bg-surface px-4 py-4 text-sm font-semibold text-muted card-shadow">
            Aucun rappel à venir. Profitez-en.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">Documents récents</h2>
        </div>
        <div className="rounded-[1.6rem] bg-surface px-2 py-2 card-shadow">
          {docs.length === 0 ? (
            <button
              type="button"
              onClick={() => open({ type: "document" })}
              className="w-full px-3 py-4 text-left text-sm font-semibold text-muted"
            >
              Aucun document — ajouter
            </button>
          ) : (
            <ul>
              {docs.map((d) => {
                const cat = categories.find((c) => c.id === d.categoryId);
                return (
                  <li key={d.id}>
                    <Link
                      to="/documents"
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface-2"
                    >
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: memberTone(cat?.color ?? "violet", "soft"),
                          color: memberTone(cat?.color ?? "violet"),
                        }}
                      >
                        <FileText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold">{d.name}</span>
                        <span className="text-xs font-semibold text-muted">
                          Ajouté le {d.createdAt.slice(8, 10)}/{d.createdAt.slice(5, 7)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Link
          to="/documents"
          className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-primary"
        >
          Voir tous les documents
          <ChevronRight className="size-4" />
        </Link>
      </section>

      {lastNote ? (
        <Link
          to="/notes"
          className="tap flex items-center gap-3 rounded-[1.5rem] bg-surface px-4 py-3 card-shadow"
        >
          {lastWho ? <MemberAvatar member={lastWho} size="sm" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-muted">Dernier message</p>
            <p className="truncate text-sm font-bold">
              <span className="text-ink">{lastWho?.firstName ?? "Famille"} · </span>
              <span className="text-muted">{lastNote.content}</span>
            </p>
          </div>
        </Link>
      ) : null}

      <p className="text-center text-xs font-semibold text-faint">
        {formatDayLong(now)}
      </p>
    </div>
  );
}
