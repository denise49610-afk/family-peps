import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useFamilyStore } from "@/lib/family/store";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

function isFresh(createdAt: string) {
  const t = new Date(createdAt).getTime();
  return !Number.isNaN(t) && Date.now() - t < DAY_MS;
}

/** Surveille les nouveaux messages chat (sync cloud inclus) et notifie */
export function ChatWatch() {
  const notes = useFamilyStore((s) => s.notes);
  const members = useFamilyStore((s) => s.members);
  const meId = useFamilyStore((s) => s.settings.currentMemberId);
  const known = useRef<Set<string> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<"granted" | "denied" | "default">("denied");

  useEffect(() => {
    setMounted(true);
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  useEffect(() => {
    const family = notes.filter((n) => n.visibility !== "personal" && isFresh(n.createdAt));
    if (known.current === null) {
      known.current = new Set(family.map((n) => n.id));
      return;
    }
    for (const n of family) {
      if (known.current.has(n.id)) continue;
      known.current.add(n.id);
      if (n.memberId && n.memberId !== meId) {
        const who = members.find((m) => m.id === n.memberId);
        const body = `${who?.firstName ?? "Quelqu’un"} : ${n.content.slice(0, 100)}`;
        toast.message(body, { duration: 5000 });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Fami'Zen · Chat", {
              body,
              icon: "/favicon.svg",
              tag: "family-peps-chat",
            });
          } catch {
            /* ignore */
          }
        }
      }
    }
    known.current = new Set(family.map((n) => n.id));
  }, [notes, meId, members]);

  if (!mounted) return null;
  if (typeof Notification === "undefined") return null;
  if (perm === "granted") return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const p = await Notification.requestPermission();
        setPerm(p);
        if (p === "granted") toast.success("Notifications activées");
        else toast.error("Permission refusée");
      }}
      className={cn(
        "fixed left-4 z-30 hidden items-center gap-2 rounded-full lg:flex",
        "bg-member-orange-soft text-member-orange-fg px-3 py-2 text-xs font-bold card-shadow tap",
        "bottom-8",
      )}
    >
      <Bell className="size-4 shrink-0" />
      Notifications chat
    </button>
  );
}
