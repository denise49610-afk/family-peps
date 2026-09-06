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

  const events: FamilyEvent[] = [
    event({
      id: "evt-cours-sofiane",
      title: "Cours - Lycée Jean Moulin",
      memberIds: [IDS.sofiane],
      categoryId: CAT.ecole,
      date: today,
      startTime: "08:30",
      endTime: "16:30",
      location: "Angers",
    }),
    event({
      id: "evt-ortho-ayyoub",
      title: "RDV Orthophoniste",
      memberIds: [IDS.ayyoub],
      categoryId: CAT.sante,
      date: today,
      startTime: "13:30",
      endTime: "14:15",
      location: "Cabinet central",
      reminderMinutes: 60,
    }),
    event({
      id: "evt-foot-papa",
      title: "Football avec Ayyoub",
      memberIds: [IDS.papa, IDS.ayyoub],
      categoryId: CAT.sport,
      date: today,
      startTime: "18:30",
      endTime: "20:00",
      location: "Stade de la Baumette",
    }),
    event({
      id: "evt-yoga-maman",
      title: "Yoga",
      memberIds: [IDS.maman],
      categoryId: CAT.maison,
      date: today,
      startTime: "19:00",
      endTime: "20:00",
      location: "Maison",
    }),
    event({
      id: "evt-reunion-sofiane",
      title: "Réunion parents profs (Sofiane)",
      memberIds: [IDS.sofiane, IDS.maman, IDS.papa],
      categoryId: CAT.ecole,
      date: dayOffset(1),
      startTime: "10:00",
      endTime: "11:00",
      location: "Lycée Jean Moulin",
      reminderMinutes: 1440,
    }),
    event({
      id: "evt-dentiste-ayyoub",
      title: "Dentiste Ayyoub",
      memberIds: [IDS.ayyoub],
      categoryId: CAT.sante,
      date: dayOffset(2),
      startTime: "09:30",
      endTime: "10:00",
      location: "Cabinet dentaire",
      reminderMinutes: 1440,
    }),
    event({
      id: "evt-ordo",
      title: "Renouvellement ordonnance",
      memberIds: [IDS.maman],
      categoryId: CAT.sante,
      date: dayOffset(3),
      startTime: "16:00",
      endTime: "16:20",
      location: "Pharmacie",
      reminderMinutes: 120,
    }),
  ];

  const tasks: FamilyTask[] = [
    task({ id: "task-m1", title: "Préparer le goûter", assigneeId: IDS.maman, dueDate: today, categoryId: CAT.maison }),
    task({ id: "task-m2", title: "Payer la cantine", assigneeId: IDS.maman, dueDate: dayOffset(1), categoryId: CAT.administratif }),
    task({ id: "task-m3", title: "Laver le maillot de foot", assigneeId: IDS.maman, dueDate: today, categoryId: CAT.maison }),
    task({ id: "task-p1", title: "Essence voiture", assigneeId: IDS.papa, dueDate: today, categoryId: CAT.vehicule }),
    task({ id: "task-p2", title: "Déposer Ayyoub à 13h", assigneeId: IDS.papa, dueDate: today, categoryId: CAT.famille }),
    task({ id: "task-p3", title: "Réparer la lampe", assigneeId: IDS.papa, dueDate: dayOffset(4), categoryId: CAT.maison }),
    task({ id: "task-a1", title: "Trousse complète", assigneeId: IDS.ayyoub, dueDate: today, categoryId: CAT.ecole }),
    task({ id: "task-a2", title: "Exercices d'orthophonie", assigneeId: IDS.ayyoub, dueDate: today, categoryId: CAT.sante }),
    task({ id: "task-a3", title: "Ranger la chambre", assigneeId: IDS.ayyoub, dueDate: dayOffset(1), categoryId: CAT.maison }),
    task({ id: "task-a4", title: "Lire 15 minutes", assigneeId: IDS.ayyoub, dueDate: today, categoryId: CAT.ecole }),
    task({ id: "task-s1", title: "Cahier de textes", assigneeId: IDS.sofiane, dueDate: today, categoryId: CAT.ecole }),
    task({ id: "task-s2", title: "Rendre le formulaire", assigneeId: IDS.sofiane, dueDate: dayOffset(1), categoryId: CAT.ecole }),
    task({ id: "task-s3", title: "Préparer le sac", assigneeId: IDS.sofiane, dueDate: today, categoryId: CAT.ecole }),
    task({ id: "task-s4", title: "Maths exercice 12", assigneeId: IDS.sofiane, dueDate: dayOffset(1), categoryId: CAT.ecole }),
  ];

  return {
    ...empty,
    settings: {
      ...empty.settings,
      city: "Angers",
      currentMemberId: IDS.maman,
      completedKeys: [
        `event:evt-cours-sofiane:${today}`,
        `event:evt-foot-papa:${today}`,
      ],
    },
    members,
    events,
    tasks,
  };
}