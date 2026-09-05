import { memberTone } from "@/components/brand";
import { timeToMinutes, weekdayLabel } from "@/lib/family/dates";
import type { MemberColor, ScheduleSlot } from "@/lib/family/types";
import { cn } from "@/lib/utils";

export type GridBlock = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
  subtitle?: string;
  color?: MemberColor;
};

export function slotsToBlocks(slots: ScheduleSlot[], color?: MemberColor): GridBlock[] {
  return slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    title: s.subject,
    subtitle: [s.room, s.teacher].filter(Boolean).join(" · ") || undefined,
    color,
  }));
}

function schoolDays(blocks: GridBlock[]): number[] {
  const used = new Set(blocks.map((b) => b.dayOfWeek));
  const days = [1, 2, 3, 4, 5];
  if (used.has(6)) days.push(6);
  if (used.has(0)) days.push(0);
  return days;
}

function hourRange(blocks: GridBlock[]): { start: number; end: number } {
  if (!blocks.length) return { start: 8, end: 17 };
  let min = 24 * 60;
  let max = 0;
  for (const b of blocks) {
    min = Math.min(min, timeToMinutes(b.startTime));
    max = Math.max(max, timeToMinutes(b.endTime || b.startTime));
  }
  const start = Math.max(7, Math.floor(min / 60));
  const end = Math.min(20, Math.max(start + 6, Math.ceil(max / 60)));
  return { start, end };
}

export function WeekGrid({
  blocks,
  onBlockClick,
  emptyHint = "Aucun cours cette semaine",
}: {
  blocks: GridBlock[];
  onBlockClick?: (block: GridBlock) => void;
  emptyHint?: string;
}) {
  const days = schoolDays(blocks);
  const { start, end } = hourRange(blocks);
  const totalMin = Math.max(60, (end - start) * 60);
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const colH = Math.max(288, (end - start) * 52);

  if (!blocks.length) {
    return (
      <p className="rounded-[1.4rem] bg-surface-2 px-4 py-8 text-center text-sm font-semibold text-muted">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-[22rem] gap-1">
        <div className="relative w-8 shrink-0" style={{ height: colH }}>
          {hours.map((h) => (
            <p
              key={h}
              className="absolute right-0 text-[10px] font-extrabold tabular-nums text-faint"
              style={{ top: `${((h - start) * 60) / totalMin * 100}%` }}
            >
              {h}h
            </p>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="min-w-0 flex-1">
            <p className="mb-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {weekdayLabel(d, true)}
            </p>
            <div className="relative overflow-hidden rounded-[1.05rem] bg-surface-2" style={{ height: colH }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-line/80"
                  style={{ top: `${((h - start) * 60) / totalMin * 100}%` }}
                />
              ))}
              {blocks
                .filter((b) => b.dayOfWeek === d)
                .map((b) => {
                  const top = ((timeToMinutes(b.startTime) - start * 60) / totalMin) * 100;
                  const dur = Math.max(
                    30,
                    timeToMinutes(b.endTime || b.startTime) - timeToMinutes(b.startTime),
                  );
                  const height = (dur / totalMin) * 100;
                  const color = b.color ?? "violet";
                  const className = cn(
                    "absolute inset-x-0.5 overflow-hidden rounded-lg px-1 py-0.5 text-left",
                    onBlockClick && "tap",
                  );
                  const style = {
                    top: `${Math.max(0, top)}%`,
                    height: `${Math.max(8, height)}%`,
                    backgroundColor: memberTone(color, "soft"),
                    color: memberTone(color, "fg"),
                  };
                  const body = (
                    <>
                      <span className="block truncate text-[10px] font-extrabold leading-tight">
                        {b.title}
                      </span>
                      <span className="block truncate text-[9px] font-bold tabular-nums opacity-70">
                        {b.startTime.slice(0, 5)}
                        {b.subtitle ? ` · ${b.subtitle}` : ""}
                      </span>
                    </>
                  );
                  if (onBlockClick) {
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onBlockClick(b)}
                        className={className}
                        style={style}
                      >
                        {body}
                      </button>
                    );
                  }
                  return (
                    <div key={b.id} className={className} style={style}>
                      {body}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
