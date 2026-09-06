export const MEMBER_COLORS = [
  "rose",
  "bleu",
  "orange",
  "violet",
  "turquoise",
  "vert",
  "jaune",
  "corail",
] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

export const MEMBER_ROLES = ["parent", "enfant", "autre"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type Recurrence = {
  freq: RecurrenceFreq;
  interval: number;
  until?: string;
  byWeekday?: number[];
};

export type SchoolInfo = {
  name: string;
  address: string;
  className: string;
  level: string;
  headTeacher: string;
  hours: string;
  important: string;
  usefulLinks: { id: string; label: string; url: string }[];
};

export type HealthDoctor = {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  address: string;
  notes: string;
};

export type HealthInfo = {
  allergies: string;
  gp: string;
  gpPhone: string;
  gpAddress: string;
  otherDoctors: string;
  doctors: HealthDoctor[];
  important: string;
  treatments: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyContacts: string;
  bloodType: string;
  notes: string;
};

export type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  role: MemberRole;
  color: MemberColor;
  photo: string | null;
  /** Emoji / sticker avatar (prioritaire si pas de photo) */
  avatar: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  school: SchoolInfo;
  health: HealthInfo;
};

/** Avatars ludiques au choix */
export const AVATAR_CHOICES = [
  "🦊", "🐼", "🦁", "🐰", "🦄", "🐸", "🐯", "🐨",
  "🐲", "🐙", "🦋", "🌟", "🚀", "⚽", "🎮", "📚",
  "🎨", "🌈", "🍕", "🎧", "💪", "🧠", "❤️", "👑",
] as const;

export type EventCategoryId = string;

export type FamilyEvent = {
  id: string;
  title: string;
  memberIds: string[];
  wholeFamily: boolean;
  categoryId: EventCategoryId;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  description: string;
  reminderMinutes: number | null;
  color: MemberColor | null;
  recurrence: Recurrence;
  attachmentIds: string[];
};

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "done";

export type FamilyTask = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  categoryId: string;
  recurrence: Recurrence;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  attachmentIds: string[];
};

export type Activity = {
  id: string;
  name: string;
  memberIds: string[];
  weekdays: number[];
  startTime: string;
  endTime: string;
  location: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  categoryId: string;
  attachmentIds: string[];
};

export type ScheduleSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
  teacher: string;
};

export type Schedule = {
  id: string;
  memberId: string;
  name: string;
  slots: ScheduleSlot[];
  /** Photo d'origine de l'emploi du temps (data URL ou asset:id). */
  photo?: string | null;
};

export type FamilyDocument = {
  id: string;
  name: string;
  categoryId: string;
  memberId: string | null;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
};

export type NoteReaction = {
  emoji: string;
  memberIds: string[];
};

export type FamilyNote = {
  id: string;
  content: string;
  visibility: "personal" | "family";
  memberId: string | null;
  date: string | null;
  pinned: boolean;
  createdAt: string;
  reactions?: NoteReaction[];
};

export type ImportantInfo = {
  id: string;
  title: string;
  content: string;
  sensitive: boolean;
  categoryId: string;
};

export type FamilyContact = {
  id: string;
  memberId: string | null;
  name: string;
  kind: "medecin" | "ecole" | "sport" | "professeur" | "famille" | "autre";
  phone: string;
  email: string;
  notes: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: MemberColor;
  builtin: boolean;
};

export type AppSettings = {
  appName: string;
  /** Nom affiché : « Bienvenue la famille … » */
  familyName: string;
  city: string;
  currentMemberId: string;
  remindersEnabled: boolean;
  defaultReminderMinutes: number;
  healthUnlocked: boolean;
  weekStartsOn: 0 | 1;
  /** Code famille partagé (ex: PEPS-A3F9) — vide = local only */
  familyCode: string;
  /** Sync cloud activée */
  cloudSync: boolean;
};

export type FamilyState = {
  settings: AppSettings;
  members: FamilyMember[];
  events: FamilyEvent[];
  tasks: FamilyTask[];
  activities: Activity[];
  schedules: Schedule[];
  documents: FamilyDocument[];
  notes: FamilyNote[];
  infos: ImportantInfo[];
  contacts: FamilyContact[];
  categories: Category[];
};

export type Occurrence = {
  id: string;
  sourceType: "event" | "schedule" | "activity" | "birthday";
  sourceId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  description: string;
  memberIds: string[];
  wholeFamily: boolean;
  categoryId: string;
  color: MemberColor | null;
  reminderMinutes: number | null;
};

export type Conflict = {
  id: string;
  memberId: string;
  a: Occurrence;
  b: Occurrence;
  reason: "overlap" | "school-activity";
};

export const EMPTY_SCHOOL: SchoolInfo = {
  name: "",
  address: "",
  className: "",
  level: "",
  headTeacher: "",
  hours: "",
  important: "",
  usefulLinks: [],
};

export const EMPTY_HEALTH: HealthInfo = {
  allergies: "",
  gp: "",
  gpPhone: "",
  gpAddress: "",
  otherDoctors: "",
  doctors: [],
  important: "",
  treatments: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyContacts: "",
  bloodType: "",
  notes: "",
};

export const NONE_RECURRENCE: Recurrence = { freq: "none", interval: 1 };

export function normalizeHealth(raw?: Partial<HealthInfo> | null): HealthInfo {
  const h = raw ?? {};
  return {
    ...EMPTY_HEALTH,
    ...h,
    doctors: Array.isArray(h.doctors) ? h.doctors : [],
    gpPhone: h.gpPhone ?? "",
    gpAddress: h.gpAddress ?? "",
    emergencyName: h.emergencyName ?? "",
    emergencyPhone: h.emergencyPhone ?? "",
  };
}

export function normalizeSchool(raw?: Partial<SchoolInfo> | null): SchoolInfo {
  const s = raw ?? {};
  return {
    ...EMPTY_SCHOOL,
    ...s,
    usefulLinks: Array.isArray(s.usefulLinks) ? s.usefulLinks : [],
  };
}
