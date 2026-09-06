import type { FamilyMember } from "@/lib/family/types";
import { AVATAR_CHOICES } from "@/lib/family/types";
import { cn } from "@/lib/utils";
import { memberTone } from "./brand";

const SIZES = {
  xs: "size-7 text-[11px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
} as const;

const EMOJI_SIZES = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
} as const;

export function initialsOf(member: Pick<FamilyMember, "firstName" | "lastName" | "nickname">) {
  const src = `${member.firstName} ${member.lastName}`.trim() || member.nickname;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function MemberAvatar({
  member,
  size = "md",
  className,
  plain = false,
}: {
  member: Pick<FamilyMember, "firstName" | "lastName" | "nickname" | "color" | "photo"> & {
    avatar?: string;
  };
  size?: keyof typeof SIZES;
  className?: string;
  plain?: boolean;
}) {
  const emoji = member.avatar?.trim();
  const ring = plain ? 0 : size === "xl" || size === "lg" ? 3 : 2;
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", SIZES[size], className)}
      style={{
        padding: ring,
        backgroundColor: plain ? "transparent" : memberTone(member.color),
        borderRadius: 9999,
      }}
    >
      <span
        className={cn(
          "flex size-full items-center justify-center overflow-hidden rounded-full font-bold",
        )}
        style={{
          backgroundColor: member.photo ? "var(--color-surface)" : memberTone(member.color, "soft"),
          color: memberTone(member.color, "fg"),
        }}
      >
        {member.photo ? (
          <img
            src={member.photo}
            alt=""
            className="size-full object-cover"
          />
        ) : emoji ? (
          <span className={cn("leading-none", EMOJI_SIZES[size])} aria-hidden>
            {emoji}
          </span>
        ) : (
          <span style={{ color: memberTone(member.color) }}>{initialsOf(member)}</span>
        )}
      </span>
    </span>
  );
}

export function MemberChip({
  member,
  onClick,
  active,
}: {
  member: FamilyMember;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold tap",
        active ? "text-ink" : "text-ink",
      )}
      style={{
        backgroundColor: memberTone(member.color, "soft"),
        boxShadow: active ? `inset 0 0 0 2px ${memberTone(member.color)}` : undefined,
      }}
    >
      <MemberAvatar member={member} size="xs" />
      {member.firstName}
    </button>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (avatar: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("")}
        className={cn(
          "flex size-10 items-center justify-center rounded-full text-xs font-bold tap",
          !value ? "ring-2 ring-primary" : "bg-surface-2",
        )}
        aria-label="Initiales"
      >
        A
      </button>
      {AVATAR_CHOICES.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          className={cn(
            "flex size-10 items-center justify-center rounded-full text-xl tap",
            value === a ? "ring-2 ring-primary bg-surface" : "bg-surface-2",
          )}
          aria-label={`Avatar ${a}`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
