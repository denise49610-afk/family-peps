import type { Category, FamilyEvent, FamilyMember, FamilyState, FamilyTask } from "./types";
import { CAT, IDS } from "./ids";
import { EMPTY_HEALTH, EMPTY_SCHOOL, NONE_RECURRENCE } from "./types";
import { toISODate } from "./dates";

export function defaultCategories(): Category[] {
  return [
    { id: CAT.ecole, name: "École", icon: "backpack", color: "orange", builtin: true },
    { id: CAT.sport, name: "Sport", icon: "dumbbell", color: "vert", builtin: true },
    { id: CAT.sante, name: "Santé", icon: "heart-pulse", color: "rose", builtin: true },
    { id: CAT.maison, name: "Maison", icon: "house", color: "jaune", builtin: true },
    { id: CAT.famille, name: "Famille", icon: "users", color: "turquoise", builtin: true },
    { id: CAT.rdv, name: "Rendez-vous", icon: "calendar-clock", color: "bleu", builtin: true },
    { id: CAT.important, name: "Important", icon: "star", color: "corail", builtin: true },
    { id: CAT.travail, name: "Travail", icon: "briefcase", color: "bleu", builtin: true },
    { id: CAT.administratif, name: "Administratif", icon: "file-text", color: "violet", builtin: true },
    { id: CAT.vehicule, name: "Véhicule", icon: "car", color: "turquoise", builtin: true },
  ];
}

function dayOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function member(
  partial: Pick<FamilyMember, "id" | "firstName" | "role" | "color"> & Partial<FamilyMember>,
): FamilyMember {
  return {
    lastName: "",
    nickname: partial.firstName,
    photo: null,
    avatar: "",
    birthDate: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    school: { ...EMPTY_SCHOOL, usefulLinks: [] },
    health: { ...EMPTY_HEALTH, doctors: [] },
    ...partial,
  };
}

function event(
  partial: Omit<
    FamilyEvent,
    | "wholeFamily"
    | "allDay"
    | "description"
    | "color"
    | "recurrence"
    | "attachmentIds"
    | "endTime"
    | "reminderMinutes"
  > &
    Partial<FamilyEvent>,
): FamilyEvent {
  return {
    wholeFamily: false,
    allDay: false,
    description: "",
    color: null,
    recurrence: NONE_RECURRENCE,
    attachmentIds: [],
    endTime: "",
    reminderMinutes: null,
    ...partial,
  };
}

function task(
  partial: Omit<FamilyTask, "description" | "priority" | "recurrence" | "status" | "completedAt" | "attachmentIds" | "createdAt"> & Partial<FamilyTask>,
): FamilyTask {
  return {
    description: "",
    priority: "medium",
    recurrence: NONE_RECURRENCE,
    status: "todo",
    completedAt: null,
    attachmentIds: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

/** App vide : rien d'inventé. L'utilisateur ajoute sa famille et ses vrais plannings. */
export function createSeedState(): FamilyState {
  return {
    settings: {
      appName: "Fami'Zen",
      familyName: "",
      city: "",
      currentMemberId: "",
      remindersEnabled: true,
      defaultReminderMinutes: 60,
      healthUnlocked: false,
      weekStartsOn: 1,
      familyCode: "",
      cloudSync: false,
      completedKeys: [],
    },
    categories: defaultCategories(),
    members: [],
    events: [],
    tasks: [],
    activities: [],
    schedules: [],
    documents: [],
    notes: [],
    infos: [],
    contacts: [],
  };
}

/** Famille d'exemple pour l'accueil — photos + journée type. */
export function createShowcaseState(): FamilyState {
  const today = dayOffset(0);
  const empty = createSeedState();
  const members: FamilyMember[] = [
    member({
      id: IDS.maman,
      firstName: "Maman",
      role: "parent",
      color: "violet",
      photo: "/avatars/maman.jpg",
    }),
    member({
      id: IDS.papa,
      firstName: "Papa",
      role: "parent",
      color: "vert",
      photo: "/avatars/papa.jpg",
      avatar: "🦁",
    }),
    member({
      id: IDS.ayyoub,
      firstName: "Ayyoub",
      role: "enfant",
      color: "orange",
      photo: "/avatars/ayyoub.jpg",
      avatar: "🦊",
    }),
    member({
      id: IDS.sofiane,
      firstName: "Sofiane",
      role: "enfant",
      color: "bleu",
      photo: "/avatars/sofiane.jpg",
      avatar: "🦁",
    }),
  ];

  // Aucun événement / tâche inventé.
  // Tu intégreras tes vrais plannings (école, travail, activités, RDV…).
  // L’IA de coordination s’activera automatiquement dès que des données réelles seront présentes.
  const events: FamilyEvent[] = [];
  const tasks: FamilyTask[] = [];

  return {
    ...empty,
    settings: {
      ...empty.settings,
      city: "",
      currentMemberId: IDS.maman,
      completedKeys: [],
    },
    members,
    events,
    tasks,
  };
}