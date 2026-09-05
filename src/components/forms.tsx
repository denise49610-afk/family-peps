import { ImportScheduleForm } from "@/components/import-schedule-form";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { memberTone } from "@/components/brand";
import { cn } from "@/lib/utils";
import { AvatarPicker, MemberAvatar } from "@/components/member-avatar";
import { useEditors } from "@/components/editors-context";
import { CAT } from "@/lib/family/ids";
import { weekdayLabel } from "@/lib/family/dates";
import { fileToStoredDataUrl } from "@/lib/family/files";
import { useFamilyStore } from "@/lib/family/store";
import {
  EMPTY_HEALTH,
  EMPTY_SCHOOL,
  MEMBER_COLOR_LABELS,
  MEMBER_COLORS,
  MEMBER_ROLES,
  NONE_RECURRENCE,
  type Activity,
  type FamilyContact,
  type FamilyEvent,
  type FamilyMember,
  type FamilyNote,
  type FamilyTask,
  type ImportantInfo,
  type MemberColor,
  type Recurrence,
  type RecurrenceFreq,
  type Schedule,
  type ScheduleSlot,
} from "@/lib/family/types";
import { uid } from "@/lib/utils";
import { todayISO } from "@/lib/family/dates";

function ColorPicker({
  value,
  onChange,
}: {
  value: MemberColor;
  onChange: (c: MemberColor) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-x-1.5 gap-y-2.5 p-0.5 sm:grid-cols-7">
      {MEMBER_COLORS.map((c) => {
        const selected = value === c;
        return (
          <button
            key={c}
            type="button"
            aria-label={MEMBER_COLOR_LABELS[c]}
            aria-pressed={selected}
            onClick={() => onChange(c)}
            className="tap flex flex-col items-center gap-1"
          >
            <span
              className="flex size-9 items-center justify-center rounded-full"
              style={{
                boxShadow: selected
                  ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${memberTone(c)}`
                  : "inset 0 0 0 1px color-mix(in oklab, var(--color-ink) 8%, transparent)",
              }}
            >
              <span
                className="size-7 rounded-full"
                style={{ backgroundColor: memberTone(c) }}
              />
            </span>
            <span
              className={cn(
                "w-full truncate text-center text-[10px] font-bold leading-tight",
                selected ? "text-ink" : "text-muted",
              )}
            >
              {MEMBER_COLOR_LABELS[c]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MemberPicker({
  value,
  onChange,
  multiple,
  allowFamily,
  wholeFamily,
  onWholeFamily,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  allowFamily?: boolean;
  wholeFamily?: boolean;
  onWholeFamily?: (v: boolean) => void;
}) {
  const members = useFamilyStore((s) => s.members);
  return (
    <div className="flex flex-wrap gap-2">
      {allowFamily && onWholeFamily ? (
        <button
          type="button"
          onClick={() => onWholeFamily(!wholeFamily)}
          className="rounded-full px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: wholeFamily ? memberTone("turquoise", "soft") : "var(--color-surface-2)",
            boxShadow: wholeFamily ? `inset 0 0 0 2px ${memberTone("turquoise")}` : undefined,
          }}
        >
          Toute la famille
        </button>
      ) : null}
      {members.map((m) => {
        const active = !wholeFamily && value.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              onWholeFamily?.(false);
              if (multiple) {
                onChange(active ? value.filter((id) => id !== m.id) : [...value, m.id]);
              } else {
                onChange([m.id]);
              }
            }}
            className="inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold"
            style={{
              backgroundColor: active ? memberTone(m.color, "soft") : "var(--color-surface-2)",
              boxShadow: active ? `inset 0 0 0 2px ${memberTone(m.color)}` : undefined,
            }}
          >
            <MemberAvatar member={m} size="xs" />
            {m.firstName}
          </button>
        );
      })}
    </div>
  );
}

function RecurrenceFields({
  value,
  onChange,
}: {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Répétition">
        <Select
          value={value.freq}
          onChange={(e) =>
            onChange({ ...value, freq: e.target.value as RecurrenceFreq })
          }
        >
          <option value="none">Une seule fois</option>
          <option value="daily">Tous les jours</option>
          <option value="weekly">Toutes les semaines</option>
          <option value="monthly">Tous les mois</option>
          <option value="yearly">Tous les ans</option>
        </Select>
      </Field>
      {value.freq !== "none" ? (
        <Field label="Jusqu'au (optionnel)">
          <Input
            type="date"
            value={value.until ?? ""}
            onChange={(e) => onChange({ ...value, until: e.target.value || undefined })}
          />
        </Field>
      ) : null}
    </div>
  );
}

function EventForm({
  id,
  date,
  memberId,
  onClose,
}: {
  id?: string;
  date?: string;
  memberId?: string;
  onClose: () => void;
}) {
  const events = useFamilyStore((s) => s.events);
  const categories = useFamilyStore((s) => s.categories);
  const addEvent = useFamilyStore((s) => s.addEvent);
  const updateEvent = useFamilyStore((s) => s.updateEvent);
  const removeEvent = useFamilyStore((s) => s.removeEvent);
  const existing = events.find((e) => e.id === id);
  const [draft, setDraft] = useState<Omit<FamilyEvent, "id">>(() => ({
    title: existing?.title ?? "",
    memberIds: existing?.memberIds ?? (memberId ? [memberId] : []),
    wholeFamily: existing?.wholeFamily ?? false,
    categoryId: existing?.categoryId ?? CAT.rdv,
    date: existing?.date ?? date ?? todayISO(),
    startTime: existing?.startTime ?? "09:00",
    endTime: existing?.endTime ?? "10:00",
    allDay: existing?.allDay ?? false,
    location: existing?.location ?? "",
    description: existing?.description ?? "",
    reminderMinutes: existing?.reminderMinutes ?? 60,
    color: existing?.color ?? null,
    recurrence: existing?.recurrence ?? NONE_RECURRENCE,
    attachmentIds: existing?.attachmentIds ?? [],
  }));

  function save() {
    if (!draft.title.trim()) {
      toast.error("Donnez un titre à l'événement");
      return;
    }
    if (existing) updateEvent(existing.id, draft);
    else addEvent(draft);
    toast.success(existing ? "Événement modifié" : "Événement ajouté");
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier l'événement" : "Nouvel événement"}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeEvent(existing.id);
                toast.success("Événement supprimé");
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Titre">
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Ex. Rendez-vous dentiste"
          />
        </Field>
        <Field label="Qui">
          <MemberPicker
            value={draft.memberIds}
            onChange={(ids) => setDraft({ ...draft, memberIds: ids })}
            multiple
            allowFamily
            wholeFamily={draft.wholeFamily}
            onWholeFamily={(v) => setDraft({ ...draft, wholeFamily: v })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Catégorie">
            <Select
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.allDay}
            onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })}
            className="size-4 accent-primary"
          />
          Toute la journée
        </label>
        {!draft.allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début">
              <Input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
              />
            </Field>
            <Field label="Fin">
              <Input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
        <Field label="Lieu">
          <Input
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="Adresse, salle…"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </Field>
        <Field label="Rappel">
          <Select
            value={String(draft.reminderMinutes ?? "")}
            onChange={(e) =>
              setDraft({
                ...draft,
                reminderMinutes: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">Aucun</option>
            <option value="15">15 minutes avant</option>
            <option value="60">1 heure avant</option>
            <option value="120">2 heures avant</option>
            <option value="1440">La veille</option>
          </Select>
        </Field>
        <RecurrenceFields
          value={draft.recurrence}
          onChange={(recurrence) => setDraft({ ...draft, recurrence })}
        />
      </div>
    </Modal>
  );
}

function TaskForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const tasks = useFamilyStore((s) => s.tasks);
  const categories = useFamilyStore((s) => s.categories);
  const members = useFamilyStore((s) => s.members);
  const addTask = useFamilyStore((s) => s.addTask);
  const updateTask = useFamilyStore((s) => s.updateTask);
  const removeTask = useFamilyStore((s) => s.removeTask);
  const existing = tasks.find((t) => t.id === id);
  const [draft, setDraft] = useState<Omit<FamilyTask, "id" | "createdAt">>(() => ({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    assigneeId: existing?.assigneeId ?? null,
    priority: existing?.priority ?? "medium",
    dueDate: existing?.dueDate ?? todayISO(),
    categoryId: existing?.categoryId ?? CAT.maison,
    recurrence: existing?.recurrence ?? NONE_RECURRENCE,
    status: existing?.status ?? "todo",
    completedAt: existing?.completedAt ?? null,
    attachmentIds: existing?.attachmentIds ?? [],
  }));

  function save() {
    if (!draft.title.trim()) {
      toast.error("Donnez un titre à la tâche");
      return;
    }
    if (existing) updateTask(existing.id, draft);
    else addTask(draft);
    toast.success(existing ? "Tâche modifiée" : "Tâche ajoutée");
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier la tâche" : "Nouvelle tâche"}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeTask(existing.id);
                toast.success("Tâche supprimée");
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Titre">
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Ex. Acheter les fournitures"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </Field>
        <Field label="Responsable">
          <Select
            value={draft.assigneeId ?? ""}
            onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value || null })}
          >
            <option value="">Toute la famille</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priorité">
            <Select
              value={draft.priority}
              onChange={(e) =>
                setDraft({ ...draft, priority: e.target.value as FamilyTask["priority"] })
              }
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </Select>
          </Field>
          <Field label="Échéance">
            <Input
              type="date"
              value={draft.dueDate ?? ""}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
            />
          </Field>
        </div>
        <Field label="Catégorie">
          <Select
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <RecurrenceFields
          value={draft.recurrence}
          onChange={(recurrence) => setDraft({ ...draft, recurrence })}
        />
      </div>
    </Modal>
  );
}

function MemberForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const members = useFamilyStore((s) => s.members);
  const addMember = useFamilyStore((s) => s.addMember);
  const existing = members.find((m) => m.id === id);
  const [firstName, setFirstName] = useState(existing?.firstName ?? "");
  const [lastName, setLastName] = useState(existing?.lastName ?? "");
  const [nickname, setNickname] = useState(existing?.nickname ?? "");
  const [role, setRole] = useState<FamilyMember["role"]>(existing?.role ?? "enfant");
  const [color, setColor] = useState<MemberColor>(existing?.color ?? "turquoise");
  const [avatar, setAvatar] = useState(existing?.avatar ?? "🦊");
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? "");

  function save() {
    if (!firstName.trim()) {
      toast.error("Le prénom est obligatoire");
      return;
    }
    addMember({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nickname: nickname.trim(),
      role,
      color,
      photo: null,
      avatar,
      birthDate,
      phone: "",
      email: "",
      address: "",
      notes: "",
      school: { ...EMPTY_SCHOOL, usefulLinks: [] },
      health: { ...EMPTY_HEALTH },
    });
    toast.success(`${firstName} a rejoint la famille`);
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nouveau membre"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Ajouter</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Prénom">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Nom">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Surnom">
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </Field>
        <Field label="Rôle">
          <Select value={role} onChange={(e) => setRole(e.target.value as FamilyMember["role"])}>
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "parent" ? "Parent" : r === "enfant" ? "Enfant" : "Autre"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date de naissance">
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label="Couleur">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field label="Avatar">
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </Field>
      </div>
    </Modal>
  );
}

function ActivityForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const activities = useFamilyStore((s) => s.activities);
  const addActivity = useFamilyStore((s) => s.addActivity);
  const updateActivity = useFamilyStore((s) => s.updateActivity);
  const removeActivity = useFamilyStore((s) => s.removeActivity);
  const existing = activities.find((a) => a.id === id);
  const [draft, setDraft] = useState<Omit<Activity, "id">>(() => ({
    name: existing?.name ?? "",
    memberIds: existing?.memberIds ?? [],
    weekdays: existing?.weekdays ?? [3],
    startTime: existing?.startTime ?? "15:00",
    endTime: existing?.endTime ?? "17:00",
    location: existing?.location ?? "",
    contactName: existing?.contactName ?? "",
    contactPhone: existing?.contactPhone ?? "",
    notes: existing?.notes ?? "",
    categoryId: existing?.categoryId ?? CAT.sport,
    attachmentIds: existing?.attachmentIds ?? [],
  }));

  function toggleDay(d: number) {
    setDraft((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(d)
        ? prev.weekdays.filter((x) => x !== d)
        : [...prev.weekdays, d],
    }));
  }

  function save() {
    if (!draft.name.trim()) {
      toast.error("Nommez l'activité");
      return;
    }
    if (existing) updateActivity(existing.id, draft);
    else addActivity(draft);
    toast.success(existing ? "Activité mise à jour" : "Activité créée — elle apparaît dans le calendrier");
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier l'activité" : "Nouvelle activité"}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeActivity(existing.id);
                toast.success("Activité supprimée");
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nom">
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Football, Judo…"
          />
        </Field>
        <Field label="Qui">
          <MemberPicker
            value={draft.memberIds}
            onChange={(ids) => setDraft({ ...draft, memberIds: ids })}
            multiple
          />
        </Field>
        <Field label="Jours">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className="rounded-full px-3 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: draft.weekdays.includes(d)
                    ? "var(--color-accent)"
                    : "var(--color-surface-2)",
                  color: draft.weekdays.includes(d)
                    ? "var(--color-accent-fg)"
                    : "var(--color-ink)",
                }}
              >
                {weekdayLabel(d, true)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début">
            <Input
              type="time"
              value={draft.startTime}
              onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
            />
          </Field>
          <Field label="Fin">
            <Input
              type="time"
              value={draft.endTime}
              onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Lieu">
          <Input
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact">
            <Input
              value={draft.contactName}
              onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              type="tel"
              value={draft.contactPhone}
              onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function NoteForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const notes = useFamilyStore((s) => s.notes);
  const members = useFamilyStore((s) => s.members);
  const addNote = useFamilyStore((s) => s.addNote);
  const updateNote = useFamilyStore((s) => s.updateNote);
  const removeNote = useFamilyStore((s) => s.removeNote);
  const existing = notes.find((n) => n.id === id);
  const [draft, setDraft] = useState<Omit<FamilyNote, "id" | "createdAt">>(() => ({
    content: existing?.content ?? "",
    visibility: existing?.visibility ?? "family",
    memberId: existing?.memberId ?? null,
    date: existing?.date ?? null,
    pinned: existing?.pinned ?? false,
  }));

  function save() {
    if (!draft.content.trim()) {
      toast.error("Écrivez une note");
      return;
    }
    if (existing) updateNote(existing.id, draft);
    else addNote(draft);
    toast.success("Note enregistrée");
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier la note" : "Nouvelle note"}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeNote(existing.id);
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Note">
          <Textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder="Ex. Ne pas oublier le certificat médical…"
          />
        </Field>
        <Field label="Visibilité">
          <Select
            value={draft.visibility}
            onChange={(e) =>
              setDraft({ ...draft, visibility: e.target.value as FamilyNote["visibility"] })
            }
          >
            <option value="family">Familiale</option>
            <option value="personal">Personnelle</option>
          </Select>
        </Field>
        <Field label="Associée à">
          <Select
            value={draft.memberId ?? ""}
            onChange={(e) => setDraft({ ...draft, memberId: e.target.value || null })}
          >
            <option value="">Toute la famille</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date (optionnel)">
          <Input
            type="date"
            value={draft.date ?? ""}
            onChange={(e) => setDraft({ ...draft, date: e.target.value || null })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.pinned}
            onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
            className="size-4 accent-primary"
          />
          Épingler
        </label>
      </div>
    </Modal>
  );
}

function InfoForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const infos = useFamilyStore((s) => s.infos);
  const categories = useFamilyStore((s) => s.categories);
  const addInfo = useFamilyStore((s) => s.addInfo);
  const updateInfo = useFamilyStore((s) => s.updateInfo);
  const removeInfo = useFamilyStore((s) => s.removeInfo);
  const existing = infos.find((i) => i.id === id);
  const [draft, setDraft] = useState<Omit<ImportantInfo, "id">>(() => ({
    title: existing?.title ?? "",
    content: existing?.content ?? "",
    sensitive: existing?.sensitive ?? false,
    categoryId: existing?.categoryId ?? CAT.important,
  }));

  function save() {
    if (!draft.title.trim()) {
      toast.error("Ajoutez un titre");
      return;
    }
    if (existing) updateInfo(existing.id, draft);
    else addInfo(draft);
    toast.success("Information enregistrée");
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier l'info" : "Nouvelle info importante"}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeInfo(existing.id);
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Titre">
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Contenu">
          <Textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
        </Field>
        <Field label="Catégorie">
          <Select
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.sensitive}
            onChange={(e) => setDraft({ ...draft, sensitive: e.target.checked })}
            className="size-4 accent-primary"
          />
          Information sensible (masquée tant que la santé n'est pas déverrouillée)
        </label>
      </div>
    </Modal>
  );
}

function DocumentForm({ onClose }: { onClose: () => void }) {
  const members = useFamilyStore((s) => s.members);
  const categories = useFamilyStore((s) => s.categories);
  const addDocument = useFamilyStore((s) => s.addDocument);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>(CAT.ecole);
  const [memberId, setMemberId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
  }

  async function save() {
    if (!file) {
      toast.error("Choisissez un fichier (photo, PDF…)");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToStoredDataUrl(file);
      addDocument({
        name: name.trim() || file.name,
        categoryId,
        memberId: memberId || null,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
      toast.success("Document ajouté 🌸");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Ajouter un document"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={busy || !file}>
            {busy ? "Ajout…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Fichier"
          hint="Galerie, Fichiers ou PDF. Stocké sur cet appareil (images compressées auto)."
        >
          {/* Input natif visible = fiable sur iOS/Android (galerie + fichiers) */}
          <Input
            ref={inputRef}
            type="file"
            accept="image/*,image/jpeg,image/png,image/webp,application/pdf,.pdf,.txt,.doc,.docx"
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {file ? (
            <p className="mt-2 rounded-xl bg-member-turquoise-soft px-3 py-2 text-sm font-semibold text-member-turquoise">
              ✅ {file.name} ({(file.size / 1024).toFixed(0)} Ko)
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Sur iPhone : toucher le champ → « Photothèque » ou « Parcourir »
            </p>
          )}
        </Field>
        <Field label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Bulletin Sofiane" />
        </Field>
        <Field label="Catégorie">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Membre">
          <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Famille</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function ContactForm({
  id,
  memberId,
  onClose,
}: {
  id?: string;
  memberId?: string;
  onClose: () => void;
}) {
  const contacts = useFamilyStore((s) => s.contacts);
  const members = useFamilyStore((s) => s.members);
  const addContact = useFamilyStore((s) => s.addContact);
  const updateContact = useFamilyStore((s) => s.updateContact);
  const removeContact = useFamilyStore((s) => s.removeContact);
  const existing = contacts.find((c) => c.id === id);
  const [draft, setDraft] = useState<Omit<FamilyContact, "id">>(() => ({
    memberId: existing?.memberId ?? memberId ?? null,
    name: existing?.name ?? "",
    kind: existing?.kind ?? "autre",
    phone: existing?.phone ?? "",
    email: existing?.email ?? "",
    notes: existing?.notes ?? "",
  }));

  function save() {
    if (!draft.name.trim()) {
      toast.error("Nom du contact obligatoire");
      return;
    }
    if (existing) updateContact(existing.id, draft);
    else addContact(draft);
    toast.success("Contact enregistré");
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier le contact" : "Nouveau contact"}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeContact(existing.id);
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Pour qui">
          <Select
            value={draft.memberId ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, memberId: e.target.value || null })
            }
          >
            <option value="">Toute la famille</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nom">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select
            value={draft.kind}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as FamilyContact["kind"] })
            }
          >
            <option value="medecin">Médecin</option>
            <option value="ecole">École</option>
            <option value="sport">Club / sport</option>
            <option value="professeur">Professeur</option>
            <option value="famille">Famille</option>
            <option value="autre">Autre</option>
          </Select>
        </Field>
        <Field label="Téléphone">
          <Input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </Field>
        <Field label="Notes">
          <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function ScheduleForm({
  id,
  memberId,
  onClose,
}: {
  id?: string;
  memberId?: string;
  onClose: () => void;
}) {
  const schedules = useFamilyStore((s) => s.schedules);
  const members = useFamilyStore((s) => s.members);
  const addSchedule = useFamilyStore((s) => s.addSchedule);
  const updateSchedule = useFamilyStore((s) => s.updateSchedule);
  const removeSchedule = useFamilyStore((s) => s.removeSchedule);
  const existing = schedules.find((s) => s.id === id);
  const [name, setName] = useState(existing?.name ?? "Emploi du temps");
  const [owner, setOwner] = useState(existing?.memberId ?? memberId ?? members[0]?.id ?? "");
  const [slots, setSlots] = useState<ScheduleSlot[]>(existing?.slots ?? []);
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");

  function addSlot() {
    if (!subject.trim()) {
      toast.error("Indiquez la matière");
      return;
    }
    setSlots((s) => [
      ...s,
      {
        id: uid("slot"),
        dayOfWeek: day,
        startTime,
        endTime,
        subject: subject.trim(),
        room,
        teacher,
      },
    ]);
    setSubject("");
  }

  function save() {
    const payload: Omit<Schedule, "id"> = {
      memberId: owner,
      name,
      slots,
      photo: existing?.photo ?? null,
    };
    if (existing) updateSchedule(existing.id, payload);
    else addSchedule(payload);
    toast.success("Planning enregistré — les cours apparaissent dans le calendrier");
    onClose();
  }

  const grouped = useMemo(() => {
    const g: Record<number, ScheduleSlot[]> = {};
    for (const slot of slots) {
      (g[slot.dayOfWeek] ??= []).push(slot);
    }
    for (const k of Object.keys(g)) {
      g[Number(k)].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return g;
  }, [slots]);

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier le planning" : "Nouveau planning"}
      wide
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeSchedule(existing.id);
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Élève">
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="mb-2 text-sm font-semibold">Ajouter un créneau</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={String(day)} onChange={(e) => setDay(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {weekdayLabel(d)}
                </option>
              ))}
            </Select>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            <Input
              placeholder="Matière"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Input placeholder="Salle" value={room} onChange={(e) => setRoom(e.target.value)} />
            <Input
              placeholder="Professeur"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
            />
          </div>
          <Button className="mt-3" variant="accent" size="sm" onClick={addSlot}>
            Ajouter le créneau
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5, 6].map((d) => (
            <div key={d}>
              <p className="mb-1 text-sm font-bold">{weekdayLabel(d)}</p>
              {(grouped[d] ?? []).length === 0 ? (
                <p className="text-sm text-muted">Aucun cours</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {(grouped[d] ?? []).map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-semibold tabular-nums">
                          {slot.startTime}–{slot.endTime}
                        </span>{" "}
                        {slot.subject}
                        {slot.room ? ` · ${slot.room}` : ""}
                      </span>
                      <button
                        type="button"
                        className="text-danger text-xs font-bold"
                        onClick={() => setSlots((s) => s.filter((x) => x.id !== slot.id))}
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function QuickMenu({ onClose }: { onClose: () => void }) {
  const { open } = useEditors();
  const items = [
    { type: "event" as const, label: "Événement", hint: "Rendez-vous, école, sport…", color: "violet" },
    { type: "task" as const, label: "Tâche", hint: "Quelque chose à ne pas oublier", color: "vert" },
    { type: "document" as const, label: "Document", hint: "Photo, PDF, carte…", color: "bleu" },
    { type: "note" as const, label: "Message", hint: "Écrire dans le chat famille", color: "turquoise" },
    { type: "member" as const, label: "Membre", hint: "Ajouter quelqu'un", color: "rose" },
    { type: "activity" as const, label: "Activité", hint: "Sport ou loisir récurrent", color: "orange" },
    { type: "schedule" as const, label: "Planning scolaire", hint: "Emploi du temps", color: "jaune" },
    { type: "import-schedule" as const, label: "Importer un planning", hint: "Photo ou copier-coller", color: "corail" },
  ];
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Créer">
      <div className="flex flex-col gap-2 pb-3">
        {items.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => {
              if (item.type === "note") {
                onClose();
                window.location.href = "/notes";
                return;
              }
              open({ type: item.type });
            }}
            className="flex min-h-14 items-center gap-3 rounded-2xl px-3 text-left tap"
            style={{ backgroundColor: `var(--color-member-${item.color}-soft)` }}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-sm font-black"
              style={{ color: `var(--color-member-${item.color})` }}
            >
              +
            </span>
            <span>
              <span className="block text-base font-extrabold">{item.label}</span>
              <span className="text-xs font-semibold opacity-70">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function EditorsHost() {
  const { target, close } = useEditors();
  if (!target) return null;
  switch (target.type) {
    case "quick":
      return <QuickMenu onClose={close} />;
    case "event":
      return (
        <EventForm
          id={target.id}
          date={target.date}
          memberId={target.memberId}
          onClose={close}
        />
      );
    case "task":
      return <TaskForm id={target.id} onClose={close} />;
    case "member":
      return <MemberForm id={target.id} onClose={close} />;
    case "activity":
      return <ActivityForm id={target.id} onClose={close} />;
    case "note":
      return <NoteForm id={target.id} onClose={close} />;
    case "info":
      return <InfoForm id={target.id} onClose={close} />;
    case "document":
      return <DocumentForm onClose={close} />;
    case "contact":
      return <ContactForm id={target.id} memberId={target.memberId} onClose={close} />;
    case "schedule":
      return <ScheduleForm id={target.id} memberId={target.memberId} onClose={close} />;
    case "import-schedule":
      return <ImportScheduleForm memberId={target.memberId} onClose={close} />;
    default:
      return null;
  }
}

export { ColorPicker };
