import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { memberTone } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { Button } from "@/components/ui/button";
import { detectConflicts, expandRange } from "@/lib/family/expand";
import {
  formatDayLong,
  formatTime,
  mondayIndex,
  toISODate,
  weekdayLabel,
} from "@/lib/family/dates";
import { useFamilyStore } from "@/lib/family/store";
import type { Occurrence } from "@/lib/family/types";
import { cn } from "@/lib/utils";

type View = "day" | "week" | "month";

function occMatches(
  occ: Occurrence,
  memberFilter: string,
  categoryFilter: string,
): boolean {
  if (memberFilter && memberFilter !== "all") {
    if (memberFilter === "family") {
      if (!occ.wholeFamily) return false;
    } else if (!occ.memberIds.includes(memberFilter)) {
      return false;
    }
  }
  if (categoryFilter && categoryFilter !== "all" && occ.categoryId !== categoryFilter) {
    return false;
  }
  return true;
}

export function CalendarBoard() {
  const store = useFamilyStore();
  const { open } = useEditors();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<View>("month");
  const [memberFilter, setMemberFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<Occurrence | null>(null);

  const range = useMemo(() => {
    if (view === "day") {
      const d = new Date(cursor);
      d.setHours(0, 0, 0, 0);
      return { from: d, to: d };
    }
    if (view === "week") {
      const from = startOfWeek(cursor, { weekStartsOn: store.settings.weekStartsOn });
      return { from, to: endOfWeek(cursor, { weekStartsOn: store.settings.weekStartsOn }) };
    }
    const start = startOfWeek(startOfMonth(cursor), {
      weekStartsOn: store.settings.weekStartsOn,
    });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: store.settings.weekStartsOn });
    return { from: start, to: end };
  }, [cursor, view, store.settings.weekStartsOn]);

  const occurrences = useMemo(() => {
    return expandRange(store, range.from, range.to).filter((o) =>
      occMatches(o, memberFilter, categoryFilter),
    );
  }, [store, range, memberFilter, categoryFilter]);

  const conflicts = useMemo(() => detectConflicts(occurrences), [occurrences]);

  function onOccClick(occ: Occurrence) {
    setSelected(occ);
  }

  function editSelected() {
    if (!selected) return;
    if (selected.sourceType === "event") open({ type: "event", id: selected.sourceId });
    else if (selected.sourceType === "activity") open({ type: "activity", id: selected.sourceId });
    else if (selected.sourceType === "schedule") open({ type: "schedule", id: selected.sourceId });
    else if (selected.sourceType === "birthday") {
      window.location.assign(`/famille/${selected.sourceId}`);
    }
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Précédent"
            onClick={() =>
              setCursor((d) =>
                view === "month" ? subMonths(d, 1) : addDays(d, view === "week" ? -7 : -1),
              )
            }
          >
            <ChevronLeft className="size-5" />
          </Button>
          <p className="min-w-40 text-center font-display text-xl font-semibold">
            {view === "day"
              ? formatDayLong(cursor)
              : format(cursor, view === "week" ? "'Semaine' w" : "MMMM yyyy", { locale: fr })}
          </p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Suivant"
            onClick={() =>
              setCursor((d) =>
                view === "month" ? addMonths(d, 1) : addDays(d, view === "week" ? 7 : 1),
              )
            }
          >
            <ChevronRight className="size-5" />
          </Button>
          <Button variant="soft" size="sm" onClick={() => setCursor(new Date())}>
            Aujourd'hui
          </Button>
        </div>
        <div className="flex rounded-full bg-surface p-1 card-shadow">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "h-9 rounded-full px-3.5 text-sm font-semibold",
                view === v ? "bg-ink text-surface" : "text-muted",
              )}
            >
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Tout le monde"
          active={memberFilter === "all"}
          onClick={() => setMemberFilter("all")}
        />
        <FilterChip
          label="Famille"
          active={memberFilter === "family"}
          color="turquoise"
          onClick={() => setMemberFilter("family")}
        />
        {store.members.map((m) => (
          <FilterChip
            key={m.id}
            label={m.firstName}
            active={memberFilter === m.id}
            color={m.color}
            photo={m.photo}
            avatar={m.avatar}
            onClick={() => setMemberFilter(m.id)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Toutes catégories"
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        />
        {store.categories.map((c) => (
          <FilterChip
            key={c.id}
            label={c.name}
            active={categoryFilter === c.id}
            color={c.color}
            onClick={() => setCategoryFilter(c.id)}
          />
        ))}
      </div>

      {conflicts.length > 0 ? (
        <div className="rounded-2xl bg-warn/10 px-4 py-3 text-sm font-semibold text-warn">
          {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""} d'horaire détecté
          {conflicts.length > 1 ? "s" : ""}. Vérifiez les chevauchements ci-dessous.
        </div>
      ) : null}

      {view === "month" ? (
        <MonthView
          cursor={cursor}
          weekStartsOn={store.settings.weekStartsOn}
          occurrences={occurrences}
          onDay={(d) => {
            setCursor(d);
            setView("day");
          }}
          onOcc={onOccClick}
          onDropEvent={(id, date) => store.moveEvent(id, date)}
        />
      ) : view === "week" ? (
        <WeekView
          from={range.from}
          occurrences={occurrences}
          onOcc={onOccClick}
          onDayClick={(d) => open({ type: "event", date: toISODate(d) })}
        />
      ) : (
        <DayView
          date={cursor}
          occurrences={occurrences.filter((o) => o.date === toISODate(cursor))}
          onOcc={onOccClick}
          onEmpty={(time) =>
            open({ type: "event", date: toISODate(cursor), memberId: undefined })
          }
        />
      )}

      {selected ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setSelected(null)}
            aria-label="Fermer"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-5 shadow-pop md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(440px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
            <p className="font-display text-2xl font-semibold">{selected.title}</p>
            <p className="mt-1 text-sm text-muted">
              {formatDayLong(selected.date)}
              {selected.allDay
                ? " · Toute la journée"
                : selected.startTime
                  ? ` · ${formatTime(selected.startTime)}${selected.endTime ? ` – ${formatTime(selected.endTime)}` : ""}`
                  : ""}
            </p>
            {selected.location ? (
              <p className="mt-1 text-sm">{selected.location}</p>
            ) : null}
            {selected.description ? (
              <p className="mt-3 text-sm leading-relaxed">{selected.description}</p>
            ) : null}
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {selected.sourceType === "schedule"
                ? "Issu du planning scolaire"
                : selected.sourceType === "activity"
                  ? "Activité récurrente"
                  : selected.sourceType === "birthday"
                    ? "Anniversaire"
                    : "Événement"}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Fermer
              </Button>
              {selected.sourceType !== "birthday" ? (
                <Button onClick={editSelected}>Modifier</Button>
              ) : (
                <Button onClick={editSelected}>Voir le profil</Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color,
  photo,
  avatar,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  photo?: string | null;
  avatar?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex max-w-full shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold"
      style={{
        backgroundColor: active
          ? color
            ? memberTone(color, "soft")
            : "var(--color-ink)"
          : "var(--color-surface)",
        color: active && !color ? "var(--color-surface)" : "var(--color-ink)",
        boxShadow: active && color ? `inset 0 0 0 2px ${memberTone(color)}` : "var(--shadow-card)",
      }}
    >
      {color && (photo || avatar) ? (
        <span
          className="inline-flex size-6 shrink-0 overflow-hidden rounded-full"
          style={{ boxShadow: `0 0 0 1.5px ${memberTone(color)}` }}
        >
          {photo ? (
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-[11px] leading-none">
              {avatar}
            </span>
          )}
        </span>
      ) : color ? (
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: memberTone(color) }}
        />
      ) : null}
      <span className="max-w-[8rem] truncate">{label}</span>
    </button>
  );
}

function MonthView({
  cursor,
  weekStartsOn,
  occurrences,
  onDay,
  onOcc,
  onDropEvent,
}: {
  cursor: Date;
  weekStartsOn: 0 | 1;
  occurrences: Occurrence[];
  onDay: (d: Date) => void;
  onOcc: (o: Occurrence) => void;
  onDropEvent: (id: string, date: string) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn });
  const days = eachDayOfInterval({ start, end });
  const headers = mondayIndex(weekStartsOn);
  const byDate = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const arr = byDate.get(o.date) ?? [];
    arr.push(o);
    byDate.set(o.date, arr);
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-surface card-shadow">
      <div className="grid grid-cols-7 border-b border-line">
        {headers.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-bold uppercase tracking-wide text-muted">
            {weekdayLabel(d, true)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = toISODate(day);
          const items = byDate.get(iso) ?? [];
          const today = isSameDay(day, new Date());
          return (
            <div
              key={iso}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/event-id");
                if (id) onDropEvent(id, iso);
              }}
              className={cn(
                "min-h-24 border-t border-r border-line p-1.5 sm:min-h-28",
                !isSameMonth(day, cursor) && "bg-surface-2/50 text-faint",
              )}
            >
              <button
                type="button"
                onClick={() => onDay(day)}
                className={cn(
                  "mb-1 flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                  today && "bg-primary text-primary-fg",
                )}
              >
                {format(day, "d")}
              </button>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    draggable={o.sourceType === "event"}
                    onDragStart={(e) => {
                      if (o.sourceType !== "event") return;
                      e.dataTransfer.setData("text/event-id", o.sourceId);
                    }}
                    onClick={() => onOcc(o)}
                    className="truncate rounded-md px-1 py-0.5 text-left text-[10px] font-bold sm:text-xs"
                    style={{
                      backgroundColor: memberTone(o.color ?? "turquoise", "soft"),
                      color: "var(--color-ink)",
                    }}
                  >
                    {o.startTime ? `${formatTime(o.startTime)} ` : ""}
                    {o.title}
                  </button>
                ))}
                {items.length > 3 ? (
                  <span className="px-1 text-[10px] font-semibold text-muted">
                    +{items.length - 3}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  from,
  occurrences,
  onOcc,
  onDayClick,
}: {
  from: Date;
  occurrences: Occurrence[];
  onOcc: (o: Occurrence) => void;
  onDayClick: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {days.map((day) => {
        const iso = toISODate(day);
        const items = occurrences.filter((o) => o.date === iso);
        const today = isSameDay(day, new Date());
        return (
          <div
            key={iso}
            className={cn(
              "rounded-2xl bg-surface p-3 card-shadow",
              today && "ring-2 ring-primary/40",
            )}
          >
            <button
              type="button"
              onClick={() => onDayClick(day)}
              className="mb-2 w-full text-left"
            >
              <p className="text-xs font-bold uppercase text-muted">{format(day, "EEE", { locale: fr })}</p>
              <p className="font-display text-xl font-semibold tabular-nums">{format(day, "d")}</p>
            </button>
            <div className="flex flex-col gap-1.5">
              {items.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onOcc(o)}
                  className="rounded-xl px-2 py-1.5 text-left text-xs font-semibold"
                  style={{ backgroundColor: memberTone(o.color ?? "turquoise", "soft") }}
                >
                  {o.startTime ? `${formatTime(o.startTime)} · ` : ""}
                  {o.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  date,
  occurrences,
  onOcc,
}: {
  date: Date;
  occurrences: Occurrence[];
  onOcc: (o: Occurrence) => void;
  onEmpty?: (time: string) => void;
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7);
  const timed = occurrences.filter((o) => !o.allDay && o.startTime);
  const allDay = occurrences.filter((o) => o.allDay || !o.startTime);

  return (
    <div className="rounded-3xl bg-surface p-3 card-shadow">
      {allDay.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {allDay.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onOcc(o)}
              className="rounded-full px-3 py-1.5 text-sm font-semibold"
              style={{ backgroundColor: memberTone(o.color ?? "turquoise", "soft") }}
            >
              {o.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        {hours.map((h) => (
          <div key={h} className="flex min-h-14 border-t border-line">
            <span className="w-12 shrink-0 pt-1 text-xs font-semibold tabular-nums text-muted">
              {h}h
            </span>
            <div className="relative flex-1" />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-0 pl-12">
          {timed.map((o) => {
            const [sh, sm] = o.startTime.split(":").map(Number);
            const [eh, em] = (o.endTime || o.startTime).split(":").map(Number);
            const startMin = sh * 60 + sm - 7 * 60;
            const endMin = eh * 60 + em - 7 * 60;
            const top = (startMin / 60) * 56;
            const height = Math.max(28, ((endMin - startMin) / 60) * 56);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onOcc(o)}
                className="pointer-events-auto absolute left-1 right-1 overflow-hidden rounded-xl px-2 py-1 text-left text-xs font-bold text-ink"
                style={{
                  top,
                  height,
                  backgroundColor: memberTone(o.color ?? "turquoise", "soft"),
                  boxShadow: `inset 3px 0 0 ${memberTone(o.color ?? "turquoise")}`,
                }}
              >
                {o.title}
                {o.location ? <span className="block font-medium opacity-70">{o.location}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
