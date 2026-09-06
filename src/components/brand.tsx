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

/** Couleurs profil — hex directs pour que les pastilles et avatars marchent
 *  même si la variable CSS Tailwind n’est pas résolue en style inline. */
const MEMBER_HEX: Record<string, { solid: string; soft: string; fg: string }> = {
  rose: { solid: "#f48fb1", soft: "#fde8f0", fg: "#6b2744" },
  corail: { solid: "#f08a8a", soft: "#ffe8e8", fg: "#6b2424" },
  rouge: { solid: "#e85d5d", soft: "#fde8e8", fg: "#6b1c1c" },
  peche: { solid: "#f3a07c", soft: "#ffeee6", fg: "#6b3318" },
  terracotta: { solid: "#d07858", soft: "#f8ebe4", fg: "#5c2c1c" },
  orange: { solid: "#f5b37a", soft: "#fff0e2", fg: "#6b3a14" },
  ambre: { solid: "#e09a3e", soft: "#fff3dc", fg: "#5c3d0c" },
  jaune: { solid: "#f5c97a", soft: "#fff6e3", fg: "#5c4310" },
  citron: { solid: "#c9bc3a", soft: "#f7f5d4", fg: "#4a4510" },
  menthe: { solid: "#6ed0a5", soft: "#e3f8ef", fg: "#165238" },
  vert: { solid: "#7bc96f", soft: "#e7f7e4", fg: "#1d4a22" },
  sapin: { solid: "#3d9a6e", soft: "#ddf3e8", fg: "#0f3d2a" },
  sauge: { solid: "#8aaa78", soft: "#eef4e8", fg: "#334428" },
  turquoise: { solid: "#7ecfc0", soft: "#e4f7f3", fg: "#1b4a42" },
  cyan: { solid: "#5cc8e0", soft: "#e0f6fb", fg: "#164a56" },
  ciel: { solid: "#8ec8f0", soft: "#e8f5fc", fg: "#1c4560" },
  bleu: { solid: "#7eb6f5", soft: "#e7f2fe", fg: "#1d3f6b" },
  marine: { solid: "#4a7cc8", soft: "#e4ecf8", fg: "#1a3258" },
  indigo: { solid: "#6b6fd4", soft: "#e8e9fa", fg: "#2a2c66" },
  violet: { solid: "#b49af0", soft: "#f1eaff", fg: "#3d2a6b" },
  lilas: { solid: "#c9a0e8", soft: "#f5eafc", fg: "#4a2a66" },
  lavande: { solid: "#a89ad8", soft: "#eeeaf8", fg: "#32285c" },
  fuchsia: { solid: "#d96bb3", soft: "#fbe8f4", fg: "#5c2048" },
  bordeaux: { solid: "#b04a62", soft: "#f8e4e8", fg: "#4a1824" },
  chocolat: { solid: "#b07a52", soft: "#f4ebe3", fg: "#4a2e1c" },
  taupe: { solid: "#9a8b7a", soft: "#f1ece6", fg: "#3f352c" },
};

export function memberTone(color: string, kind: "solid" | "soft" | "fg" = "solid"): string {
  const safe = color && /^[a-z]+$/.test(color) ? color : "turquoise";
  const entry = MEMBER_HEX[safe] ?? MEMBER_HEX.turquoise;
  return entry[kind];
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
