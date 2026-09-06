import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Menu, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { memberTone } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { MemberAvatar } from "@/components/member-avatar";
import { MemberSwitcher } from "@/components/member-switcher";
import { CalendarBoard } from "@/components/calendar-board";
import { openMoreMenu } from "@/components/shell";
import { expandRange } from "@/lib/family/expand";
import { formatDayLong, formatTime, toISODate, todayISO } from "@/lib/family/dates";
import { useFamilyStore } from "@/lib/family/store";
import type { Occurrence } from "@/lib/family/types";
import { cn, capitalize } from "@/lib/utils";

type Tab = "today" | "tomorrow" | "week";

const HOURS = [8, 10, 12, 14, 16, 18, 20];

export function PlanningTimeline() {
  const store = useFamilyStore();
  const { open } = useEditors();
  const [tab, setTab] = useState<Tab>("today");
  const [offset, setOffset] = useState(0);
  const [agenda, setAgenda] = useState(false);
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [who, setWho] = useState("all");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const cursor = useMemo(() => addDays(today, offset), [today, offset]);
  const rangeFrom = tab === "week" ? cursor : cursor;
  const rangeTo = tab === "week" ? addDays(cursor, 6) : cursor;

  const occ = useMemo(
    () =>
      expandRange(store, rangeFrom, rangeTo)
        .filter((o) => (who === "all" ? true : o.memberIds.includes(who)))
        .sort((a, b) =>
          (a.startTime || "99").localeCompare(b.startTime || "99"),
        ),
    [store, rangeFrom, rangeTo, who],
  );

  const whoName =
    who === "all" ? null : store.members.find((m) => m.id === who)?.firstName;

  if (agenda) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setAgenda(false)}
            className="text-sm font-extrabold text-primary"
          >
            ← Vue simple
          </button>
        </div>
        <CalendarBoard />
      </div>
    );
  }

  const days =
    tab === "week"
      ? Array.from({ length: 7 }, (_, i) => addDays(cursor, i))
      : [cursor];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-primary/8 px-3.5 py-3">
        <p className="font-display text-[1.05rem] font-extrabold text-ink">Agenda familial</p>
        <p className="mt-0.5 text-[12px] font-semibold text-muted">
          Toute la famille sur un seul calendrier. Les photos d’école sont dans{" "}
          <button
            type="button"
            className="font-extrabold text-primary underline-offset-2 hover:underline"
            onClick={() => {
              window.location.href = "/plannings";
            }}
          >
            École
          </button>
          .
        </p>
      </div>
      <header className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Menu"
          onClick={() => openMoreMenu()}
          className="flex size-11 items-center justify-center rounded-full bg-surface card-shadow lg:invisible"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="font-display text-[1.65rem] font-extrabold">
          {whoName ? whoName : "Planning"}
        </h1>
        <button
          type="button"
          aria-label="Vue mois"
          onClick={() => setAgenda(true)}
          className="flex size-11 items-center justify-center rounded-full bg-surface card-shadow"
        >
          <CalendarDays className="size-5" />
        </button>
      </header>

      <MemberSwitcher activeId={who} onSelect={setWho} allowAll allLabel="Tous" />

      <div className="flex rounded-full bg-surface p-1 card-shadow">
        {(
          [
            ["today", "Aujourd'hui"],
            ["tomorrow", "Demain"],
            ["week", "Cette semaine"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setOffset(id === "tomorrow" ? 1 : 0);
            }}
            className={cn(
              "h-10 flex-1 rounded-full px-2 text-xs font-extrabold sm:text-sm",
              tab === id ? "bg-ink text-surface" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "week" ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Jour précédent"
            onClick={() => {
              setTab("today");
              setOffset((n) => n - 1);
            }}
            className="flex size-11 items-center justify-center rounded-full bg-surface card-shadow"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="font-display text-lg font-extrabold">
            {offset === 0 ? "Aujourd'hui" : offset === 1 ? "Demain" : formatDayLong(cursor)}
          </p>
          <button
            type="button"
            aria-label="Jour suivant"
            onClick={() => {
              setTab("today");
              setOffset((n) => n + 1);
            }}
            className="flex size-11 items-center justify-center rounded-full bg-surface card-shadow"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      ) : null}

      {tab !== "week" ? (
        <p className="-mt-2 text-center text-sm font-bold text-muted">
          {capitalize(format(cursor, "EEEE d MMMM", { locale: fr }))}
        </p>
      ) : null}

      {days.map((day) => {
        const iso = toISODate(day);
        const items = occ.filter((o) => o.date === iso);
        return (
          <DayTimeline
            key={iso}
            date={day}
            showDate={tab === "week"}
            items={items}
            members={store.members}
            onOcc={setSelected}
            onEmpty={() => open({ type: "event", date: iso })}
          />
        );
      })}

      {selected ? (
        <OccSheet
          occ={selected}
          members={store.members}
          onClose={() => setSelected(null)}
          onEdit={() => {
            if (selected.sourceType === "event") open({ type: "event", id: selected.sourceId });
            else if (selected.sourceType === "activity") open({ type: "activity", id: selected.sourceId });
            else if (selected.sourceType === "schedule") open({ type: "schedule", id: selected.sourceId });
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

function DayTimeline({
  date,
  showDate,
  items,
  members,
  onOcc,
  onEmpty,
}: {
  date: Date;
  showDate: boolean;
  items: Occurrence[];
  members: ReturnType<typeof useFamilyStore.getState>["members"];
  onOcc: (o: Occurrence) => void;
  onEmpty: () => void;
}) {
  const byHour = new Map<number, Occurrence[]>();
  const extra: Occurrence[] = [];
  for (const o of items) {
    if (o.allDay || !o.startTime) {
      extra.push(o);
      continue;
    }
    const h = Number(o.startTime.slice(0, 2));
    const bucket = HOURS.reduce((best, cur) => (Math.abs(cur - h) < Math.abs(best - h) ? cur : best), HOURS[0]);
    const arr = byHour.get(bucket) ?? [];
    arr.push(o);
    byHour.set(bucket, arr);
  }

  return (
    <div>
      {showDate ? (
        <p className="mb-3 font-display text-lg font-extrabold">
          {capitalize(format(date, "EEEE d MMMM", { locale: fr }))}
          {toISODate(date) === todayISO() ? " · Aujourd'hui" : ""}
        </p>
      ) : null}
      {extra.length > 0 ? (
        <div className="mb-3 flex flex-col gap-2">
          {extra.map((o) => (
            <OccCard key={o.id} occ={o} members={members} onClick={() => onOcc(o)} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col">
        {HOURS.map((h) => {
          const list = byHour.get(h) ?? [];
          return (
            <div key={h} className="grid grid-cols-[3.2rem_1fr] gap-3 py-1.5">
              <p className="pt-3 text-right text-sm font-extrabold tabular-nums text-muted">
                {String(h).padStart(2, "0")}h
              </p>
              <div className="min-h-14">
                {list.length === 0 ? (
                  <button
                    type="button"
                    onClick={onEmpty}
                    className="h-10 w-full rounded-2xl"
                    aria-label={`Ajouter à ${h}h`}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {list.map((o) => (
                      <OccCard key={o.id} occ={o} members={members} onClick={() => onOcc(o)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OccCard({
  occ,
  members,
  onClick,
}: {
  occ: Occurrence;
  members: ReturnType<typeof useFamilyStore.getState>["members"];
  onClick: () => void;
}) {
  const who = members.filter((m) => occ.memberIds.includes(m.id));
  const color = occ.color ?? who[0]?.color ?? "turquoise";
  const isMeal = /déjeuner|diner|dîner|repas|déjeuner/i.test(occ.title);
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex w-full items-center gap-3 rounded-[1.35rem] px-3 py-3 text-left"
      style={{ backgroundColor: memberTone(color, "soft") }}
    >
      {who[0] ? (
        <MemberAvatar member={who[0]} size="sm" />
      ) : isMeal ? (
        <span className="flex size-9 items-center justify-center rounded-full bg-white/80 text-member-jaune-fg">
          <Utensils className="size-4" />
        </span>
      ) : (
        <span
          className="flex size-9 items-center justify-center rounded-full bg-white/80 text-sm font-black"
          style={{ color: memberTone(color) }}
        >
          {occ.wholeFamily ? "F" : "•"}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold">{occ.title}</span>
        <span className="text-xs font-bold opacity-70">
          {occ.wholeFamily
            ? "Famille"
            : who.map((m) => m.firstName).join(", ") || "Famille"}
        </span>
      </span>
    </button>
  );
}

function OccSheet({
  occ,
  members,
  onClose,
  onEdit,
}: {
  occ: Occurrence;
  members: ReturnType<typeof useFamilyStore.getState>["members"];
  onClose: () => void;
  onEdit: () => void;
}) {
  const who = members.filter((m) => occ.memberIds.includes(m.id));
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-ink/30" aria-label="Fermer" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-surface p-5 shadow-pop md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(420px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem]">
        <p className="font-display text-2xl font-extrabold">{occ.title}</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          {formatDayLong(occ.date)}
          {occ.startTime ? ` · ${formatTime(occ.startTime)}` : ""}
          {occ.endTime ? ` – ${formatTime(occ.endTime)}` : ""}
        </p>
        {who.length > 0 ? (
          <div className="mt-3 flex gap-2">
            {who.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 text-sm font-bold">
                <MemberAvatar member={m} size="xs" />
                {m.firstName}
              </span>
            ))}
          </div>
        ) : null}
        {occ.location ? <p className="mt-2 text-sm">{occ.location}</p> : null}
        {occ.description ? <p className="mt-2 text-sm leading-relaxed">{occ.description}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl px-4 text-sm font-extrabold text-muted"
          >
            Fermer
          </button>
          {occ.sourceType !== "birthday" ? (
            <button
              type="button"
              onClick={onEdit}
              className="h-11 rounded-2xl bg-primary px-4 text-sm font-extrabold text-primary-fg"
            >
              Modifier
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
