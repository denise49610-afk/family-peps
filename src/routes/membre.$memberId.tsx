import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { addDays, startOfWeek } from "date-fns";
import { Phone, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/forms";
import { AvatarPicker, MemberAvatar } from "@/components/member-avatar";
import { MemberSwitcher } from "@/components/member-switcher";
import { useEditors } from "@/components/editors-context";
import {
  DayHoursStrip,
  SchoolPhotoHero,
  SchoolPhotoLightbox,
} from "@/components/school-planning";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { fileToStoredDataUrl } from "@/lib/family/files";
import { ageOn, todayISO, weekdayLabel } from "@/lib/family/dates";
import { expandRange } from "@/lib/family/expand";
import { useFamilyStore } from "@/lib/family/store";
import { normalizeHealth, normalizeSchool } from "@/lib/family/types";
import type { FamilyMember, HealthDoctor, MemberColor } from "@/lib/family/types";
import { uid } from "@/lib/utils";

export const Route = createFileRoute("/membre/$memberId")({
  component: MemberPage,
});

type Tab = "planning" | "infos";

function MemberPage() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();
  const members = useFamilyStore((s) => s.members);
  const allContacts = useFamilyStore((s) => s.contacts);
  const schedules = useFamilyStore((s) => s.schedules);
  const updateMember = useFamilyStore((s) => s.updateMember);
  const removeMember = useFamilyStore((s) => s.removeMember);
  const addContact = useFamilyStore((s) => s.addContact);
  const updateContact = useFamilyStore((s) => s.updateContact);
  const healthUnlocked = useFamilyStore((s) => s.settings.healthUnlocked);
  const updateSettings = useFamilyStore((s) => s.updateSettings);
  const { open } = useEditors();
  const [tab, setTab] = useState<Tab>("planning");

  const raw = useMemo(
    () => members.find((m) => m.id === memberId),
    [members, memberId],
  );
  const contacts = useMemo(
    () => allContacts.filter((c) => c.memberId === memberId),
    [allContacts, memberId],
  );

  const member = useMemo(() => {
    if (!raw) return null;
    return {
      ...raw,
      school: normalizeSchool(raw.school),
      health: normalizeHealth(raw.health),
    };
  }, [raw]);

  const ownSchedule = schedules.find((s) => s.memberId === memberId);

  if (!member) {
    return (
      <div className="rounded-2xl bg-surface p-6 card-shadow">
        <p>Membre introuvable.</p>
        <Link to="/famille" className="mt-3 inline-block font-semibold text-primary">
          Retour à la famille
        </Link>
      </div>
    );
  }

  const age = ageOn(member.birthDate);

  function patch<K extends keyof FamilyMember>(key: K, value: FamilyMember[K]) {
    updateMember(memberId, { [key]: value } as Partial<FamilyMember>);
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await fileToStoredDataUrl(file);
      updateMember(memberId, { photo: dataUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo trop lourde");
    }
  }

  function syncDoctorContact(name: string, phone: string) {
    const existing = contacts.find((c) => c.kind === "medecin");
    if (!name.trim() && !phone.trim()) return;
    if (existing) {
      updateContact(existing.id, {
        name: name.trim() || existing.name,
        phone: phone.trim() || existing.phone,
      });
    } else {
      addContact({
        memberId,
        name: name.trim() || "Médecin",
        kind: "medecin",
        phone: phone.trim(),
        email: "",
        notes: "",
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/famille" className="text-sm font-semibold text-muted">
          ← Ma famille
        </Link>
        {members.length > 1 ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm(`Supprimer ${member.firstName} ?`)) {
                removeMember(member.id);
                toast.success("Membre retiré");
                void navigate({ to: "/famille" });
              }
            }}
          >
            <Trash2 className="size-4" />
            Supprimer
          </Button>
        ) : null}
      </div>

      <MemberSwitcher activeId={memberId} />

      <header className="flex items-center gap-4 rounded-[1.6rem] bg-surface p-5 card-shadow">
        <label className="cursor-pointer">
          <MemberAvatar member={member} size="xl" />
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
        </label>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-sm font-semibold text-muted">
            {age != null ? `${age} ans` : member.role === "parent" ? "Parent" : "Enfant"}
            {member.school.className ? ` · ${member.school.className}` : ""}
          </p>
          {member.phone ? (
            <a
              href={`tel:${member.phone}`}
              className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-3 text-sm font-extrabold text-accent-fg"
            >
              <Phone className="size-4" />
              {member.phone}
            </a>
          ) : (
            <p className="mt-1 text-xs font-semibold text-faint">Touchez la photo pour la changer</p>
          )}
        </div>
      </header>

      <div className="flex rounded-full bg-surface p-1 card-shadow">
        {(
          [
            ["planning", "Planning"],
            ["infos", "Infos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "h-10 flex-1 rounded-full bg-ink text-sm font-extrabold text-surface"
                : "h-10 flex-1 rounded-full text-sm font-extrabold text-muted"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "planning" ? (
        <MemberPlanning memberId={memberId} scheduleName={ownSchedule?.name} />
      ) : (
        <MemberInfos
          member={member}
          memberId={memberId}
          contacts={contacts}
          healthUnlocked={healthUnlocked}
          patch={patch}
          updateSettings={updateSettings}
          syncDoctorContact={syncDoctorContact}
          onAddContact={() => open({ type: "contact", memberId })}
          onEditContact={(id) => open({ type: "contact", id, memberId })}
        />
      )}
    </div>
  );
}

function MemberPlanning({
  memberId,
  scheduleName,
}: {
  memberId: string;
  scheduleName?: string;
}) {
  const store = useFamilyStore();
  const { open } = useEditors();
  const member = store.members.find((m) => m.id === memberId);
  const isChild = member?.role === "enfant";
  const memberActivities = store.activities.filter((a) => a.memberIds.includes(memberId));
  const own = store.schedules.filter((s) => s.memberId === memberId);
  const slots = own.flatMap((s) => s.slots);
  const photo = own.find((s) => s.photo)?.photo ?? null;
  const [openPhoto, setOpenPhoto] = useState(Boolean(photo));
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const occ = expandRange(store, weekStart, addDays(weekStart, 6)).filter(
    (o) => o.memberIds.includes(memberId) && o.sourceType !== "birthday",
  );

  const today = todayISO();
  const todayItems = occ
    .filter((o) => o.date === today)
    .sort((a, b) => (a.startTime || "99").localeCompare(b.startTime || "99"));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[1.6rem] bg-surface p-4 card-shadow">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-extrabold">
              {isChild ? "Planning de l'école" : "Planning de travail"}
            </h2>
            <p className="text-xs font-semibold text-muted">
              {scheduleName ||
                (isChild
                  ? "Uniquement le planning de cette personne — pas le calendrier familial"
                  : "Horaires de travail — pas le calendrier familial")}
            </p>
          </div>
        </div>

        {photo ? (
          <div className="mb-4">
            <SchoolPhotoHero
              photo={photo}
              alt={`Emploi du temps de ${member?.firstName ?? ""}`}
              onOpen={() => setOpenPhoto(true)}
            />
          </div>
        ) : null}

        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
          Horaires du jour
        </p>
        <DayHoursStrip
          slots={slots}
          color={member?.color}
          emptyHint={
            isChild
              ? "Pas encore de planning — importez une photo ou collez le tableau Pronote."
              : "Pas encore de planning — ajoutez les horaires ou une photo du planning."
          }
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => open({ type: "import-schedule", memberId })}
          >
            <Upload className="size-4" />
            Importer
          </Button>
          <Button
            variant="soft"
            onClick={() =>
              open({
                type: "schedule",
                id: own[0]?.id,
                memberId,
              })
            }
          >
            <Plus className="size-4" />
            {own[0] ? "Modifier" : "Créer"}
          </Button>
        </div>
        {openPhoto && photo ? (
          <SchoolPhotoLightbox
            photo={photo}
            alt={`Emploi du temps de ${member?.firstName ?? ""}`}
            onClose={() => setOpenPhoto(false)}
          />
        ) : null}
      </section>

      <section className="rounded-[1.6rem] bg-surface p-4 card-shadow">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">Sport &amp; activités</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => open({ type: "activity" })}
          >
            <Plus className="size-4" />
            Ajouter
          </Button>
        </div>
        {memberActivities.length === 0 ? (
          <p className="text-sm font-semibold text-muted">
            Aucune activité récurrente pour {member?.firstName ?? "cette personne"}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memberActivities.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => open({ type: "activity", id: a.id })}
                  className="flex w-full items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{a.name}</p>
                    <p className="text-xs font-semibold text-muted">
                      {(a.daySlots?.length
                        ? a.daySlots.map((s) => `${weekdayLabel(s.dayOfWeek, true)} ${s.startTime}`)
                        : a.weekdays.map((d) => weekdayLabel(d, true))
                      ).join(" · ")}
                      {a.location ? ` · ${a.location}` : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[1.6rem] bg-surface p-4 card-shadow">
        <h2 className="mb-3 font-display text-lg font-extrabold">Aujourd'hui</h2>
        {todayItems.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Rien de prévu aujourd'hui.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todayItems.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{o.title}</p>
                  <p className="text-xs font-semibold text-muted">
                    {o.startTime ? o.startTime : "Journée"}
                    {o.location ? ` · ${o.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => open({ type: "event", memberId, date: today })}
        >
          <Plus className="size-4" />
          Ajouter un rendez-vous
        </Button>
      </section>
    </div>
  );
}

function MemberInfos({
  member,
  memberId,
  contacts,
  healthUnlocked,
  patch,
  updateSettings,
  syncDoctorContact,
  onAddContact,
  onEditContact,
}: {
  member: FamilyMember;
  memberId: string;
  contacts: ReturnType<typeof useFamilyStore.getState>["contacts"];
  healthUnlocked: boolean;
  patch: <K extends keyof FamilyMember>(key: K, value: FamilyMember[K]) => void;
  updateSettings: (p: { healthUnlocked: boolean }) => void;
  syncDoctorContact: (name: string, phone: string) => void;
  onAddContact: () => void;
  onEditContact: (id: string) => void;
}) {
  const isChild = member.role === "enfant";
  const doctors: HealthDoctor[] =
    member.health.doctors.length > 0
      ? member.health.doctors
      : member.health.gp
        ? [
            {
              id: "gp",
              name: member.health.gp,
              specialty: "Médecin traitant",
              phone: member.health.gpPhone,
              address: member.health.gpAddress,
              notes: "",
            },
          ]
        : [];

  function setGp(name: string, phone: string, address = member.health.gpAddress) {
    const next = {
      ...member.health,
      gp: name,
      gpPhone: phone,
      gpAddress: address,
      doctors:
        member.health.doctors.length > 0
          ? member.health.doctors.map((d, i) =>
              i === 0 ? { ...d, name, phone, address } : d,
            )
          : name.trim()
            ? [
                {
                  id: uid("doc"),
                  name,
                  specialty: "Médecin traitant",
                  phone,
                  address,
                  notes: "",
                },
              ]
            : [],
    };
    patch("health", next);
    syncDoctorContact(name, phone);
  }

  return (
    <div className="flex flex-col gap-5">
      <Section title="Coordonnées">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Téléphone">
            <Input
              type="tel"
              inputMode="tel"
              placeholder="06 12 34 56 78"
              value={member.phone}
              onChange={(e) => patch("phone", e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={member.email}
              onChange={(e) => patch("email", e.target.value)}
            />
          </Field>
          <Field label="Adresse">
            <Input value={member.address} onChange={(e) => patch("address", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Médecin">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom du médecin">
            <Input
              placeholder="Dr Dupont"
              value={member.health.gp}
              onChange={(e) => setGp(e.target.value, member.health.gpPhone)}
            />
          </Field>
          <Field label="Numéro">
            <Input
              type="tel"
              inputMode="tel"
              placeholder="02 41 …"
              value={member.health.gpPhone}
              onChange={(e) => setGp(member.health.gp, e.target.value)}
            />
          </Field>
          <Field label="Adresse du cabinet">
            <Input
              value={member.health.gpAddress}
              onChange={(e) => setGp(member.health.gp, member.health.gpPhone, e.target.value)}
            />
          </Field>
        </div>
        {member.health.gpPhone ? (
          <a
            href={`tel:${member.health.gpPhone}`}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-accent px-3 text-sm font-extrabold text-accent-fg"
          >
            <Phone className="size-4" />
            Appeler le médecin
          </a>
        ) : null}
        <Field label="Urgence — personne à appeler">
          <Input
            placeholder="Nom"
            value={member.health.emergencyName}
            onChange={(e) =>
              patch("health", { ...member.health, emergencyName: e.target.value })
            }
          />
        </Field>
        <Field label="Urgence — numéro">
          <Input
            type="tel"
            inputMode="tel"
            value={member.health.emergencyPhone}
            onChange={(e) =>
              patch("health", { ...member.health, emergencyPhone: e.target.value })
            }
          />
        </Field>
        {doctors.length > 1 ? (
          <ul className="flex flex-col gap-2">
            {doctors.slice(1).map((d) => (
              <li key={d.id} className="rounded-2xl bg-surface-2 px-3 py-2 text-sm">
                <p className="font-extrabold">{d.name}</p>
                <p className="text-muted">
                  {d.specialty}
                  {d.phone ? ` · ${d.phone}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title={isChild ? "École / études" : "Travail / quotidien"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isChild ? "Établissement" : "Lieu de travail"}>
            <Input
              value={member.school.name}
              onChange={(e) => patch("school", { ...member.school, name: e.target.value })}
            />
          </Field>
          <Field label="Adresse">
            <Input
              value={member.school.address}
              onChange={(e) =>
                patch("school", { ...member.school, address: e.target.value })
              }
            />
          </Field>
          {isChild ? (
            <>
              <Field label="Classe">
                <Input
                  value={member.school.className}
                  onChange={(e) =>
                    patch("school", { ...member.school, className: e.target.value })
                  }
                />
              </Field>
              <Field label="Niveau">
                <Input
                  value={member.school.level}
                  onChange={(e) =>
                    patch("school", { ...member.school, level: e.target.value })
                  }
                />
              </Field>
              <Field label="Professeur principal">
                <Input
                  value={member.school.headTeacher}
                  onChange={(e) =>
                    patch("school", { ...member.school, headTeacher: e.target.value })
                  }
                />
              </Field>
            </>
          ) : null}
          <Field label="Horaires">
            <Input
              value={member.school.hours}
              onChange={(e) =>
                patch("school", { ...member.school, hours: e.target.value })
              }
            />
          </Field>
        </div>
        <Field label="À retenir">
          <Textarea
            value={member.school.important}
            onChange={(e) =>
              patch("school", { ...member.school, important: e.target.value })
            }
          />
        </Field>
        <Field label="Lien utile (ENT, Pronote…)">
          <Input
            value={member.school.usefulLinks[0]?.url ?? ""}
            placeholder="https://"
            onChange={(e) =>
              patch("school", {
                ...member.school,
                usefulLinks: [
                  {
                    id: member.school.usefulLinks[0]?.id ?? "link-1",
                    label: member.school.usefulLinks[0]?.label || "Lien",
                    url: e.target.value,
                  },
                ],
              })
            }
          />
        </Field>
      </Section>

      <Section title="Santé">
        <p className="mb-1 text-sm text-muted">
          Allergies et traitements restent masqués par défaut.
        </p>
        {!healthUnlocked ? (
          <Button variant="outline" onClick={() => updateSettings({ healthUnlocked: true })}>
            Afficher les informations de santé
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Allergies">
              <Textarea
                value={member.health.allergies}
                onChange={(e) =>
                  patch("health", { ...member.health, allergies: e.target.value })
                }
              />
            </Field>
            <Field label="Traitements">
              <Textarea
                value={member.health.treatments}
                onChange={(e) =>
                  patch("health", { ...member.health, treatments: e.target.value })
                }
              />
            </Field>
            <Field label="Groupe sanguin">
              <Input
                value={member.health.bloodType}
                onChange={(e) =>
                  patch("health", { ...member.health, bloodType: e.target.value })
                }
              />
            </Field>
            <Field label="Autres médecins">
              <Input
                value={member.health.otherDoctors}
                onChange={(e) =>
                  patch("health", { ...member.health, otherDoctors: e.target.value })
                }
              />
            </Field>
            <Field label="Notes médicales">
              <Textarea
                value={member.health.notes}
                onChange={(e) =>
                  patch("health", { ...member.health, notes: e.target.value })
                }
              />
            </Field>
            <Button variant="ghost" onClick={() => updateSettings({ healthUnlocked: false })}>
              Masquer à nouveau
            </Button>
          </div>
        )}
      </Section>

      <Section title="Contacts importants">
        <div className="flex flex-col gap-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-3 py-3"
            >
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => onEditContact(c.id)}
              >
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted">
                  {contactKindLabel(c.kind)}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </button>
              {c.phone ? (
                <a
                  href={`tel:${c.phone}`}
                  className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-fg"
                  aria-label={`Appeler ${c.name}`}
                >
                  <Phone className="size-4" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <Button className="mt-3" variant="outline" onClick={onAddContact}>
          Ajouter un contact
        </Button>
      </Section>

      <Section title="Fiche personnelle">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prénom">
            <Input value={member.firstName} onChange={(e) => patch("firstName", e.target.value)} />
          </Field>
          <Field label="Nom">
            <Input value={member.lastName} onChange={(e) => patch("lastName", e.target.value)} />
          </Field>
          <Field label="Surnom">
            <Input value={member.nickname} onChange={(e) => patch("nickname", e.target.value)} />
          </Field>
          <Field label="Rôle">
            <Select
              value={member.role}
              onChange={(e) => patch("role", e.target.value as FamilyMember["role"])}
            >
              <option value="parent">Parent</option>
              <option value="enfant">Enfant</option>
              <option value="autre">Autre</option>
            </Select>
          </Field>
          <Field label="Date de naissance">
            <Input
              type="date"
              value={member.birthDate}
              onChange={(e) => patch("birthDate", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes personnelles">
          <Textarea value={member.notes} onChange={(e) => patch("notes", e.target.value)} />
        </Field>
        <Field label="Couleur">
          <ColorPicker value={member.color} onChange={(c: MemberColor) => patch("color", c)} />
        </Field>
        <Field label="Avatar (choisis ton personnage)">
          <AvatarPicker value={member.avatar || ""} onChange={(a) => patch("avatar", a)} />
        </Field>
      </Section>
    </div>
  );
}

function contactKindLabel(kind: string) {
  switch (kind) {
    case "medecin":
      return "Médecin";
    case "ecole":
      return "École";
    case "sport":
      return "Sport";
    case "professeur":
      return "Professeur";
    case "famille":
      return "Famille";
    default:
      return "Contact";
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.6rem] bg-surface p-5 card-shadow">
      <h2 className="mb-4 font-display text-xl font-extrabold">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
