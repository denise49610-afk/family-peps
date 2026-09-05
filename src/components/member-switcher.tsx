import { Link } from "@tanstack/react-router";
import { MemberAvatar } from "@/components/member-avatar";
import { memberTone } from "@/components/brand";
import { useFamilyStore } from "@/lib/family/store";
import { cn } from "@/lib/utils";

export function MemberSwitcher({
  activeId,
  onSelect,
  allowAll,
  allLabel = "Toute la famille",
}: {
  activeId: string;
  onSelect?: (id: string) => void;
  allowAll?: boolean;
  allLabel?: string;
}) {
  const members = useFamilyStore((s) => s.members);

  return (
    <div className="flex flex-wrap gap-2">
      {allowAll ? (
        <button
          type="button"
          onClick={() => onSelect?.("all")}
          className={cn(
            "tap flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-extrabold",
            activeId === "all" ? "bg-ink text-surface" : "bg-surface text-muted card-shadow",
          )}
        >
          {allLabel}
        </button>
      ) : null}
      {members.map((m) => {
        const active = m.id === activeId;
        const inner = (
          <>
            <MemberAvatar member={m} size="xs" />
            <span className="max-w-[7.5rem] truncate">{m.firstName}</span>
          </>
        );
        const cls = cn(
          "tap flex h-11 max-w-full shrink-0 items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-sm font-extrabold",
          active ? "text-ink" : "bg-surface text-ink card-shadow",
        );
        const style = active
          ? {
              backgroundColor: memberTone(m.color, "soft"),
              boxShadow: `inset 0 0 0 2px ${memberTone(m.color)}`,
            }
          : undefined;
        if (onSelect) {
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className={cls}
              style={style}
            >
              {inner}
            </button>
          );
        }
        return (
          <Link
            key={m.id}
            to="/membre/$memberId"
            params={{ memberId: m.id }}
            className={cls}
            style={style}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}