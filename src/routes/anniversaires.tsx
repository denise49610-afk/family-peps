import { createFileRoute, Link } from "@tanstack/react-router";
import { Cake } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState, PageHeader } from "@/components/ui/empty";
import { ageOn, daysUntil, nextBirthday } from "@/lib/family/dates";
import { useFamilyStore } from "@/lib/family/store";
import { capitalize } from "@/lib/utils";

export const Route = createFileRoute("/anniversaires")({
  component: AnniversairesPage,
});

function AnniversairesPage() {
  const members = useFamilyStore((s) => s.members);
  const list = members
    .filter((m) => m.birthDate)
    .map((m) => {
      const next = nextBirthday(m.birthDate)!;
      return {
        member: m,
        next,
        in: daysUntil(next),
        turning: ageOn(m.birthDate, next) ?? 0,
      };
    })
    .sort((a, b) => a.in - b.in);

  return (
    <div>
      <PageHeader
        title="Anniversaires"
        subtitle="Calculés automatiquement à partir des dates de naissance."
      />
      {list.length === 0 ? (
        <EmptyState
          icon={Cake}
          title="Aucune date enregistrée"
          hint="Ajoutez une date de naissance dans la fiche d'un membre."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((b) => (
            <li key={b.member.id}>
              <Link
                to="/membre/$memberId"
                params={{ memberId: b.member.id }}
                className="flex items-center gap-4 rounded-3xl bg-surface p-4 card-shadow"
              >
                <MemberAvatar member={b.member} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold">{b.member.firstName}</p>
                  <p className="text-sm text-muted">
                    {capitalize(format(b.next, "d MMMM", { locale: fr }))} · {b.turning} ans
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-2 px-3 py-2 text-center">
                  <p className="font-display text-2xl font-semibold tabular-nums leading-none">
                    {b.in}
                  </p>
                  <p className="text-[11px] font-bold uppercase text-muted">
                    {b.in === 0 ? "aujourd'hui" : b.in === 1 ? "jour" : "jours"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
