import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell, Phone, Plus } from "lucide-react";
import { memberTone } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/empty";
import { formatTime, weekdayLabel } from "@/lib/family/dates";
import { useFamilyStore } from "@/lib/family/store";

export const Route = createFileRoute("/activites")({ component: ActivitesPage });

function ActivitesPage() {
  const activities = useFamilyStore((s) => s.activities);
  const members = useFamilyStore((s) => s.members);
  const { open } = useEditors();

  return (
    <div>
      <PageHeader
        title="Sports & activités"
        subtitle="Les horaires récurrents se synchronisent avec le calendrier."
        action={
          <Button onClick={() => open({ type: "activity" })}>
            <Plus className="size-4" />
            Activité
          </Button>
        }
      />
      {activities.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Pas encore d'activité"
          hint="Football, judo, musique… ajoutez les créneaux hebdomadaires."
          action={<Button onClick={() => open({ type: "activity" })}>Créer une activité</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {activities.map((a) => {
            const people = members.filter((m) => a.memberIds.includes(m.id));
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => open({ type: "activity", id: a.id })}
                className="rounded-3xl bg-surface p-5 text-left card-shadow tap"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-semibold">{a.name}</p>
                    <p className="text-sm text-muted">
                      {a.weekdays.map((d) => weekdayLabel(d, true)).join(", ")} ·{" "}
                      {formatTime(a.startTime)} – {formatTime(a.endTime)}
                    </p>
                    {a.location ? <p className="mt-1 text-sm">{a.location}</p> : null}
                  </div>
                  <div className="flex -space-x-2">
                    {people.map((m) => (
                      <MemberAvatar key={m.id} member={m} size="sm" />
                    ))}
                  </div>
                </div>
                {a.contactPhone ? (
                  <a
                    href={`tel:${a.contactPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent"
                  >
                    <Phone className="size-4" />
                    {a.contactName || "Appeler"}
                  </a>
                ) : null}
                {people[0] ? (
                  <span
                    className="mt-3 block h-1.5 rounded-full"
                    style={{ backgroundColor: memberTone(people[0].color) }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
