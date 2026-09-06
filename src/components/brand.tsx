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
  const safe = color && /^[a-z]+$/.test(color) ? color : "turquoise";
  if (kind === "soft") return `var(--color-member-${safe}-soft)`;
  if (kind === "fg") return `var(--color-member-${safe}-fg)`;
  return `var(--color-member-${safe})`;
}

export function Spark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3", className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 0c.4 3.2 1.6 5.2 4.8 5.8C9.6 6.4 8.4 8.4 8 11.6 7.6 8.4 6.4 6.4 3.2 5.8 6.4 5.2 7.6 3.2 8 0Z" />
    </svg>
  );
}

export function SparkBurst({ className }: { className?: string }) {
  return (
    <span className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      <Spark className="absolute -left-1.5 top-1 size-2.5 text-primary opacity-80" />
      <Spark className="absolute -right-2 top-0 size-2 text-primary/70" />
      <Spark className="absolute -right-1 bottom-1 size-2.5 text-zen-e" />
      <Spark className="absolute left-0 bottom-0 size-1.5 text-primary/60" />
    </span>
  );
}
