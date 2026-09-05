import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[1.65rem] font-extrabold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm font-semibold text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.6rem] bg-surface px-6 py-12 text-center card-shadow">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <p className="font-display text-xl font-extrabold">{title}</p>
      <p className="mt-1 max-w-sm text-sm font-semibold text-muted">{hint}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
