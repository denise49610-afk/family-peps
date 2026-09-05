import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEditors } from "@/components/editors-context";
import { MemberAvatar } from "@/components/member-avatar";
import { memberTone } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/empty";
import { ageOn } from "@/lib/family/dates";
import { useFamilyStore } from "@/lib/family/store";

export const Route = createFileRoute("/famille")({ component: FamillePage });

function FamillePage() {
  const members = useFamilyStore((s) => s.members);
  const { open } = useEditors();

  return (
    <div>
      <PageHeader
        title="Ma famille"
        subtitle="Ajoutez vos proches, puis touchez une fiche pour tout modifier."
        action={
          <Button onClick={() => open({ type: "member" })}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        }
      />
      {members.length === 0 ? (
        <div className="rounded-3xl bg-surface p-8 text-center card-shadow">
          <p className="font-display text-xl font-semibold">Votre famille commence ici 🌸</p>
          <p className="mt-2 text-sm text-muted">Ajoutez Papa, Maman, les enfants… chaque fiche est modifiable.</p>
          <Button className="mt-4" onClick={() => open({ type: "member" })}>
            <Plus className="size-4" />
            Ajouter un membre
          </Button>
        </div>
      ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => {
          const age = ageOn(m.birthDate);
          return (
            <Link
              key={m.id}
              to="/membre/$memberId"
              params={{ memberId: m.id }}
              className="flex items-center gap-4 rounded-3xl bg-surface p-4 card-shadow tap"
              style={{ boxShadow: `inset 6px 0 0 ${memberTone(m.color)}, var(--shadow-card)` }}
            >
              <MemberAvatar member={m} size="lg" />
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold">
                  {m.firstName} {m.lastName}
                </p>
                <p className="text-sm text-muted">
                  {m.nickname ? `${m.nickname} · ` : ""}
                  {m.role === "parent" ? "Parent" : m.role === "enfant" ? "Enfant" : "Membre"}
                  {age != null ? ` · ${age} ans` : ""}
                </p>
                {m.phone ? (
                  <p className="mt-1 truncate text-sm font-semibold">{m.phone}</p>
                ) : m.school.className ? (
                  <p className="mt-1 truncate text-sm font-semibold">{m.school.className}</p>
                ) : m.health?.gp ? (
                  <p className="mt-1 truncate text-sm font-semibold">Médecin : {m.health.gp}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
