import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path
        d="M16 8.2c.4 2.4 1.4 3.8 3.6 4.4-2.2.6-3.2 2-3.6 4.4-.4-2.4-1.4-3.8-3.6-4.4 2.2-.6 3.2-2 3.6-4.4Z"
        fill="white"
      />
      <circle cx="11.2" cy="20.6" r="2.2" fill="white" />
      <circle cx="20.8" cy="20.6" r="2.2" fill="white" />
    </svg>
  );
}

export function FamiZenWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-[1.15rem]",
    md: "text-[1.45rem]",
    lg: "text-[1.85rem]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-black tracking-tight",
        sizes[size],
        className,
      )}
    >
      <span className="text-ink">FAMI'</span>
      <span className="text-zen-z">Z</span>
      <span className="text-zen-e">E</span>
      <span className="text-zen-n">N</span>
    </span>
  );
}

export function memberTone(color: string, kind: "solid" | "soft" | "fg" = "solid"): string {
  if (kind === "soft") return `var(--color-member-${color}-soft)`;
  if (kind === "fg") return `var(--color-member-${color}-fg)`;
  return `var(--color-member-${color})`;
}
