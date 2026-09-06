import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckSquare,
  FolderOpen,
  Home,
  MessageCircle,
  Plus,
  Settings,
  Users,
  Backpack,
  Cake,
  Dumbbell,
  Siren,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FamiZenWordmark, SparkBurst } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { useFamilyStore } from "@/lib/family/store";
import { useHydrated } from "@/lib/family/use-hydrated";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: LucideIcon };

const PRIMARY: NavItem[] = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/calendrier", label: "Agenda", icon: CalendarDays },
  { to: "/taches", label: "Tâches", icon: CheckSquare },
  { to: "/notes", label: "Chat", icon: MessageCircle },
];

const MORE: NavItem[] = [
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/famille", label: "Famille", icon: Users },
  { to: "/plannings", label: "École", icon: Backpack },
  { to: "/activites", label: "Sports", icon: Dumbbell },
  { to: "/anniversaires", label: "Anniversaires", icon: Cake },
  { to: "/infos", label: "Urgences", icon: Siren },
  { to: "/parametres", label: "Réglages", icon: Settings },
];

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function SideLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active = isActive(pathname, item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold",
        active ? "bg-primary/10 text-primary" : "text-ink/70 hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          active ? "bg-primary text-primary-fg" : "bg-surface-2 text-ink/70",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
      </span>
      {item.label}
    </Link>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 zen-wash">
      <FamiZenWordmark size="lg" />
      <p className="text-sm font-semibold text-muted">Un instant…</p>
    </div>
  );
}

function ShellInner({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open } = useEditors();
  const [more, setMore] = useState(false);
  const tasks = useFamilyStore((s) => s.tasks);
  const pending = tasks.filter((t) => t.status !== "done").length;

  useEffect(() => {
    setMore(false);
  }, [pathname]);

  useEffect(() => {
    const onOpen = () => setMore(true);
    window.addEventListener("famizen-more", onOpen);
    return () => window.removeEventListener("famizen-more", onOpen);
  }, []);

  return (
    <div className="zen-wash min-h-dvh text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/90 px-3 py-5 backdrop-blur-md lg:flex">
        <Link to="/" className="mb-6 flex items-center gap-2 px-2">
          <FamiZenWordmark size="sm" />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {PRIMARY.map((item) => (
            <SideLink key={item.to} item={item} pathname={pathname} />
          ))}
          <button
            type="button"
            onClick={() => open({ type: "quick" })}
            className="mt-2 mb-2 flex min-h-11 items-center gap-3 rounded-2xl bg-primary px-3 text-sm font-bold text-primary-fg tap"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
              <Plus className="size-5" />
            </span>
            Créer
          </button>
          <p className="mt-3 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">
            Aussi
          </p>
          {MORE.map((item) => (
            <SideLink key={item.to} item={item} pathname={pathname} />
          ))}
        </nav>
      </aside>

      <main className="lg:pl-60">
        <div
          className="mx-auto w-full max-w-[440px] px-4 pt-4 lg:max-w-3xl lg:px-8 lg:pt-8"
          style={{ paddingBottom: "calc(6.4rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {children ?? <Outlet />}
        </div>
      </main>

      <nav
        className="fixed inset-x-3 z-30 lg:hidden"
        style={{ bottom: "max(0.7rem, env(safe-area-inset-bottom))" }}
      >
        <ul className="nav-dock relative grid grid-cols-5 items-end rounded-[1.85rem] bg-surface px-1 pb-2 pt-2">
          {PRIMARY.slice(0, 2).map((item) => (
            <MobileTab
              key={item.to}
              item={item}
              pathname={pathname}
              badge={item.to === "/taches" ? pending : 0}
            />
          ))}
          <li className="relative flex justify-center">
            <span className="relative -mt-8">
              <SparkBurst className="scale-125" />
              <button
                type="button"
                aria-label="Créer"
                onClick={() => open({ type: "quick" })}
                className="nav-plus relative z-10 flex size-[3.7rem] items-center justify-center rounded-full bg-primary text-primary-fg tap"
              >
                <Plus className="size-7" strokeWidth={2.6} />
              </button>
            </span>
          </li>
          {PRIMARY.slice(2).map((item) => (
            <MobileTab
              key={item.to}
              item={item}
              pathname={pathname}
              badge={item.to === "/taches" ? pending : 0}
            />
          ))}
        </ul>
      </nav>

      {more ? <MoreSheet pathname={pathname} onClose={() => setMore(false)} /> : null}
    </div>
  );
}

function MobileTab({
  item,
  pathname,
  badge,
}: {
  item: NavItem;
  pathname: string;
  badge?: number;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.to);
  return (
    <li>
      <Link
        to={item.to}
        className={cn(
          "relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-bold",
          active ? "text-primary" : "text-muted",
        )}
      >
        <span className="relative">
          <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
          {badge && badge > 0 ? (
            <span className="count-badge absolute -right-2.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black">
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </span>
        {item.label}
      </Link>
    </li>
  );
}

function MoreSheet({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Fermer le menu"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-surface px-4 pb-10 pt-4 shadow-pop">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-extrabold">Menu</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-11 items-center justify-center rounded-full bg-surface-2"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MORE.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-2xl px-3 text-sm font-bold",
                  active ? "bg-primary/10 text-primary" : "bg-surface-2 text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    active ? "bg-primary text-primary-fg" : "bg-surface text-ink/70",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <Splash />;
  return <ShellInner>{children}</ShellInner>;
}

export const MORE_PAGES: NavItem[] = MORE;

export function openMoreMenu() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("famizen-more"));
  }
}
