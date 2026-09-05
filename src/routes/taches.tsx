import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { memberTone } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { MemberAvatar } from "@/components/member-avatar";
import { useFamilyStore } from "@/lib/family/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/taches")({ component: TachesPage });

function TachesPage() {
  const tasks = useFamilyStore((s) => s.tasks);
  const members = useFamilyStore((s) => s.members);
  const categories = useFamilyStore((s) => s.categories);
  const toggleTask = useFamilyStore((s) => s.toggleTask);
  const { open } = useEditors();
  const [showDone, setShowDone] = useState(false);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const list = showDone ? done : openTasks;

  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.65rem] font-extrabold">Tâches</h1>
          <p className="text-sm font-semibold text-muted">Une chose à la fois</p>
        </div>
        <button
          type="button"
          onClick={() => open({ type: "task" })}
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-fg card-shadow"
          aria-label="Ajouter une tâche"
        >
          <Plus className="size-5" />
        </button>
      </header>

      <div className="mb-4 flex rounded-full bg-surface p-1 card-shadow">
        <button
          type="button"
          onClick={() => setShowDone(false)}
          className={cn(
            "h-10 flex-1 rounded-full text-sm font-extrabold",
            !showDone ? "bg-ink text-surface" : "text-muted",
          )}
        >
          En cours ({openTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setShowDone(true)}
          className={cn(
            "h-10 flex-1 rounded-full text-sm font-extrabold",
            showDone ? "bg-ink text-surface" : "text-muted",
          )}
        >
          Terminées ({done.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-[1.6rem] bg-surface px-6 py-12 text-center card-shadow">
          <p className="font-display text-lg font-extrabold">
            {showDone ? "Pas encore d'historique" : "Tout est à jour"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {showDone ? "Les tâches cochées apparaîtront ici." : "Ajoutez une tâche familiale."}
          </p>
          {!showDone ? (
            <button
              type="button"
              onClick={() => open({ type: "task" })}
              className="mt-4 h-11 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-fg"
            >
              Nouvelle tâche
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((t) => {
            const who = members.find((m) => m.id === t.assigneeId);
            const cat = categories.find((c) => c.id === t.categoryId);
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-[1.4rem] bg-surface p-3 card-shadow"
              >
                <button
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.status === "done" ? "Décocher" : "Marquer comme faite"}
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 text-lg font-black",
                    t.status === "done"
                      ? "border-ok bg-ok text-white"
                      : t.priority === "high"
                        ? "border-danger"
                        : "border-line",
                  )}
                >
                  {t.status === "done" ? "✓" : ""}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => open({ type: "task", id: t.id })}
                >
                  <p
                    className={cn(
                      "font-extrabold",
                      t.status === "done" && "text-muted line-through",
                    )}
                  >
                    {t.title}
                  </p>
                  <p className="text-xs font-bold text-muted">
                    {who ? who.firstName : "Famille"}
                    {t.dueDate ? ` · ${t.dueDate.slice(8)}/${t.dueDate.slice(5, 7)}` : ""}
                    {cat ? ` · ${cat.name}` : ""}
                    {t.priority === "high" ? " · Urgent" : ""}
                  </p>
                </button>
                {who ? <MemberAvatar member={who} size="sm" /> : (
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: memberTone("turquoise") }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
