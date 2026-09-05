import { Maximize2, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { memberTone } from "@/components/brand";
import { mondayIndex, weekdayLabel } from "@/lib/family/dates";
import type { MemberColor, ScheduleSlot } from "@/lib/family/types";

export type DayHours = { dayOfWeek: number; start: string; end: string };

/** Pour chaque jour : heure de début la plus tôt + heure de fin la plus tard. */
export function computeDayHours(slots: ScheduleSlot[]): DayHours[] {
  const byDay = new Map<number, DayHours>();
  for (const s of slots) {
    const existing = byDay.get(s.dayOfWeek);
    if (!existing) {
      byDay.set(s.dayOfWeek, {
        dayOfWeek: s.dayOfWeek,
        start: s.startTime,
        end: s.endTime,
      });
      continue;
    }
    if (s.startTime < existing.start) existing.start = s.startTime;
    if (s.endTime > existing.end) existing.end = s.endTime;
  }
  return mondayIndex(1)
    .filter((d) => byDay.has(d))
    .map((d) => byDay.get(d)!);
}

function formatHour(hhmm: string): string {
  const [h, m] = (hhmm || "").split(":");
  if (!h) return "";
  return m && m !== "00" ? `${h}h${m}` : `${h}h`;
}

/** Un jour → début → fin. C'est tout. */
export function DayHoursStrip({
  slots,
  color = "violet",
  emptyHint = "Pas encore d'horaires — importez une photo de l'emploi du temps.",
}: {
  slots: ScheduleSlot[];
  color?: MemberColor;
  emptyHint?: string;
}) {
  const days = computeDayHours(slots);
  if (!days.length) {
    return (
      <p className="rounded-[1.2rem] bg-surface-2 px-4 py-6 text-center text-sm font-semibold text-muted">
        {emptyHint}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {days.slice(0, 5).map((d) => (
        <div
          key={d.dayOfWeek}
          className="flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 text-center"
          style={{ backgroundColor: memberTone(color, "soft") }}
        >
          <span
            className="text-[10px] font-extrabold uppercase tracking-wide opacity-70"
            style={{ color: memberTone(color, "fg") }}
          >
            {weekdayLabel(d.dayOfWeek, true)}
          </span>
          <span
            className="text-[13px] font-extrabold leading-tight tabular-nums"
            style={{ color: memberTone(color, "fg") }}
          >
            {formatHour(d.start)}
          </span>
          <span
            className="text-[11px] font-bold leading-tight tabular-nums opacity-60"
            style={{ color: memberTone(color, "fg") }}
          >
            → {formatHour(d.end)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Photo d'emploi du temps en grand, visible tout de suite. Un tap = plein écran. */
export function SchoolPhotoHero({
  photo,
  alt = "Emploi du temps",
  onOpen,
}: {
  photo: string;
  alt?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap group relative block w-full overflow-hidden rounded-[1.4rem] bg-surface-2"
      aria-label="Voir l'emploi du temps en grand"
    >
      <img
        src={photo}
        alt={alt}
        className="max-h-[min(70vh,520px)] w-full object-contain"
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-ink/50 via-ink/10 to-transparent pb-3 pt-10">
        <span className="flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[12px] font-extrabold text-ink">
          <ZoomIn className="size-3.5" />
          Voir en plein écran
        </span>
      </span>
    </button>
  );
}

export function SchoolPhotoThumb({
  photo,
  alt = "Emploi du temps",
  onOpen,
}: {
  photo: string;
  alt?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap group relative block w-full overflow-hidden rounded-2xl bg-surface-2"
    >
      <img src={photo} alt={alt} className="max-h-40 w-full object-cover" />
      <span className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-ink/40 via-transparent to-transparent p-2">
        <span className="flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-extrabold text-ink">
          <Maximize2 className="size-3" />
          Agrandir
        </span>
      </span>
    </button>
  );
}

export function SchoolPhotoLightbox({
  photo,
  alt = "Emploi du temps",
  onClose,
}: {
  photo: string;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex flex-col bg-ink/95"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="truncate text-sm font-extrabold text-surface/90">{alt}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="tap flex size-11 shrink-0 items-center justify-center rounded-full bg-surface/95 text-ink"
        >
          <X className="size-5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 pt-1"
      >
        <img
          src={photo}
          alt={alt}
          className="max-h-full max-w-full rounded-[1rem] object-contain shadow-pop"
          draggable={false}
        />
      </button>
      <p className="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 text-center text-[11px] font-semibold text-surface/50">
        Touchez pour fermer
      </p>
    </div>,
    document.body,
  );
}
