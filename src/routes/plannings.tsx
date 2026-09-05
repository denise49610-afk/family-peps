import { createFileRoute, Link } from "@tanstack/react-router";
import { Backpack, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useEditors } from "@/components/editors-context";
import { MemberAvatar } from "@/components/member-avatar";
import { ShareFamilyCard } from "@/components/share-family";
import {
  DayHoursStrip,
  SchoolPhotoHero,
  SchoolPhotoLightbox,
} from "@/components/school-planning";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/empty";
import { useFamilyStore } from "@/lib/family/store";

export const Route = createFileRoute("/plannings")({ component: PlanningsPage });

function PlanningsPage() {
  const schedules = useFamilyStore((s) => s.schedules);
  const members = useFamilyStore((s) => s.members);
  const { open } = useEditors();
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="École"
        subtitle="Chacun son planning, séparé du calendrier familial. Photo en grand + horaires du jour."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => open({ type: "import-schedule" })}>
              <Upload className="size-4" />
              Importer
            </Button>
            <Button onClick={() => open({ type: "schedule" })}>
              <Plus className="size-4" />
              Créer
            </Button>
          </div>
        }
      />
      <div className="mb-4">
        <ShareFamilyCard compact />
      </div>
      {members.length === 0 ? (
        <EmptyState
          icon={Backpack}
          title="Aucun planning"
          hint="Ajoutez d'abord un membre, puis importez une photo d'emploi du temps."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {members.map((member) => {
            const sch = schedules.filter((s) => s.memberId === member.id);
            const slots = sch.flatMap((s) => s.slots);
            const photo = sch.find((s) => s.photo)?.photo ?? null;
            return (
              <div key={member.id} className="rounded-3xl bg-surface p-5 card-shadow">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Link
                    to="/membre/$memberId"
                    params={{ memberId: member.id }}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <MemberAvatar member={member} size="sm" />
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold">{member.firstName}</p>
                      <p className="text-sm text-muted">
                        {slots.length ? (sch[0]?.name ?? "Planning") : "Pas encore d'emploi du temps"}
                      </p>
                    </div>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => open({ type: "import-schedule", memberId: member.id })}
                  >
                    {slots.length ? "Re-importer" : "Importer"}
                  </Button>
                </div>

                {photo ? (
                  <div className="mb-3">
                    <SchoolPhotoHero
                      photo={photo}
                      alt={`Emploi du temps de ${member.firstName}`}
                      onOpen={() => setOpenPhoto(photo)}
                    />
                  </div>
                ) : null}

                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  Horaires du jour
                </p>
                <DayHoursStrip slots={slots} color={member.color} />

                {sch[0] ? (
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        open({ type: "schedule", id: sch[0]!.id, memberId: member.id })
                      }
                    >
                      Modifier à la main
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {openPhoto ? (
        <SchoolPhotoLightbox photo={openPhoto} onClose={() => setOpenPhoto(null)} />
      ) : null}
    </div>
  );
}
