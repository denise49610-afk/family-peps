import { createFileRoute } from "@tanstack/react-router";
import { Plus, Siren } from "lucide-react";
import { useEditors } from "@/components/editors-context";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/empty";
import { useFamilyStore } from "@/lib/family/store";

export const Route = createFileRoute("/infos")({ component: InfosPage });

function InfosPage() {
  const infos = useFamilyStore((s) => s.infos);
  const categories = useFamilyStore((s) => s.categories);
  const unlocked = useFamilyStore((s) => s.settings.healthUnlocked);
  const { open } = useEditors();

  return (
    <div>
      <PageHeader
        title="Infos importantes"
        subtitle="Ce que toute la famille doit pouvoir retrouver tout de suite."
        action={
          <Button onClick={() => open({ type: "info" })}>
            <Plus className="size-4" />
            Info
          </Button>
        }
      />
      {infos.length === 0 ? (
        <EmptyState
          icon={Siren}
          title="Rien ici pour l'instant"
          hint="Numéros, codes, consignes… à un seul endroit."
          action={<Button onClick={() => open({ type: "info" })}>Ajouter une info</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {infos.map((info) => {
            const cat = categories.find((c) => c.id === info.categoryId);
            const hidden = info.sensitive && !unlocked;
            return (
              <button
                key={info.id}
                type="button"
                onClick={() => open({ type: "info", id: info.id })}
                className="rounded-3xl bg-surface p-5 text-left card-shadow tap"
              >
                <div className="mb-1 flex items-center gap-2">
                  {info.sensitive ? (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold uppercase text-danger">
                      Sensible
                    </span>
                  ) : null}
                  <span className="text-xs font-bold uppercase text-muted">{cat?.name}</span>
                </div>
                <p className="font-display text-xl font-semibold">{info.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {hidden ? "Contenu masqué — déverrouillez la santé dans le profil." : info.content}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
