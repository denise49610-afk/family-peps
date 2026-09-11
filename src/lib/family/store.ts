import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSeedState } from "./seed";
import { uid } from "./ids";
import type {
  Activity,
  AppSettings,
  Category,
  FamilyContact,
  FamilyDocument,
  FamilyEvent,
  FamilyMember,
  FamilyNote,
  FamilyState,
  FamilyTask,
  ImportantInfo,
  Schedule,
} from "./types";

type FamilyActions = {
  updateSettings: (patch: Partial<AppSettings>) => void;
  addMember: (member: Omit<FamilyMember, "id"> & { id?: string }) => string;
  updateMember: (id: string, patch: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;
  addEvent: (event: Omit<FamilyEvent, "id"> & { id?: string }) => string;
  updateEvent: (id: string, patch: Partial<FamilyEvent>) => void;
  removeEvent: (id: string) => void;
  addTask: (task: Omit<FamilyTask, "id" | "createdAt"> & { id?: string }) => string;
  updateTask: (id: string, patch: Partial<FamilyTask>) => void;
  removeTask: (id: string) => void;
  addActivity: (activity: Omit<Activity, "id"> & { id?: string }) => string;
  updateActivity: (id: string, patch: Partial<Activity>) => void;
  removeActivity: (id: string) => void;
  addSchedule: (schedule: Omit<Schedule, "id"> & { id?: string }) => string;
  updateSchedule: (id: string, patch: Partial<Schedule>) => void;
  removeSchedule: (id: string) => void;
  addDocument: (doc: Omit<FamilyDocument, "id" | "createdAt"> & { id?: string }) => string;
  updateDocument: (id: string, patch: Partial<FamilyDocument>) => void;
  removeDocument: (id: string) => void;
  addNote: (note: Omit<FamilyNote, "id" | "createdAt"> & { id?: string }) => string;
  updateNote: (id: string, patch: Partial<FamilyNote>) => void;
  removeNote: (id: string) => void;
  toggleNoteReaction: (id: string, emoji: string, memberId: string) => void;
  addInfo: (info: Omit<ImportantInfo, "id"> & { id?: string }) => string;
  updateInfo: (id: string, patch: Partial<ImportantInfo>) => void;
  removeInfo: (id: string) => void;
  addContact: (contact: Omit<FamilyContact, "id"> & { id?: string }) => string;
  updateContact: (id: string, patch: Partial<FamilyContact>) => void;
  removeContact: (id: string) => void;
  addCategory: (category: Omit<Category, "id" | "builtin"> & { id?: string }) => string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  resetDemo: () => void;
  wipeAll: () => void;
  toggleCompleted: (key: string) => void;
};

export type FamilyStore = FamilyState & FamilyActions;

function emptyFamily(): FamilyState {
  return createSeedState();
}

export const useFamilyStore = create<FamilyStore>()(
  persist(
    (set, get) => ({
      ...emptyFamily(),
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      addMember: (member) => {
        const id = member.id ?? uid("mem");
        set((s) => ({ members: [...s.members, { ...member, id } as FamilyMember] }));
        return id;
      },
      updateMember: (id, patch) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMember: (id) => {
        const { members, settings } = get();
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          settings: {
            ...s.settings,
            currentMemberId:
              settings.currentMemberId === id
                ? members.find((m) => m.id !== id)?.id ?? ""
                : s.settings.currentMemberId,
          },
        }));
      },
      addEvent: (event) => {
        const id = event.id ?? uid("evt");
        set((s) => ({ events: [...s.events, { ...event, id } as FamilyEvent] }));
        return id;
      },
      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      addTask: (task) => {
        const id = task.id ?? uid("tsk");
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              ...task,
              id,
              createdAt: new Date().toISOString(),
            } as FamilyTask,
          ],
        }));
        return id;
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      addActivity: (activity) => {
        const id = activity.id ?? uid("act");
        set((s) => ({ activities: [...s.activities, { ...activity, id } as Activity] }));
        return id;
      },
      updateActivity: (id, patch) =>
        set((s) => ({
          activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeActivity: (id) =>
        set((s) => ({ activities: s.activities.filter((a) => a.id !== id) })),
      addSchedule: (schedule) => {
        const id = schedule.id ?? uid("sch");
        set((s) => ({ schedules: [...s.schedules, { ...schedule, id } as Schedule] }));
        return id;
      },
      updateSchedule: (id, patch) =>
        set((s) => ({
          schedules: s.schedules.map((sch) => (sch.id === id ? { ...sch, ...patch } : sch)),
        })),
      removeSchedule: (id) =>
        set((s) => ({ schedules: s.schedules.filter((sch) => sch.id !== id) })),
      addDocument: (doc) => {
        const id = doc.id ?? uid("doc");
        set((s) => ({
          documents: [
            ...s.documents,
            { ...doc, id, createdAt: new Date().toISOString() } as FamilyDocument,
          ],
        }));
        return id;
      },
      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
      addNote: (note) => {
        const id = note.id ?? uid("note");
        set((s) => ({
          notes: [
            ...s.notes,
            { ...note, id, createdAt: new Date().toISOString() } as FamilyNote,
          ],
        }));
        return id;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      toggleNoteReaction: (id, emoji, memberId) =>
        set((s) => ({
          notes: s.notes.map((n) => {
            if (n.id !== id) return n;
            const reactions = [...(n.reactions ?? [])];
            const idx = reactions.findIndex((r) => r.emoji === emoji);
            if (idx < 0) {
              reactions.push({ emoji, memberIds: [memberId] });
            } else {
              const r = reactions[idx]!;
              const has = r.memberIds.includes(memberId);
              reactions[idx] = {
                ...r,
                memberIds: has
                  ? r.memberIds.filter((m) => m !== memberId)
                  : [...r.memberIds, memberId],
              };
              if (reactions[idx]!.memberIds.length === 0) reactions.splice(idx, 1);
            }
            return { ...n, reactions };
          }),
        })),
      addInfo: (info) => {
        const id = info.id ?? uid("info");
        set((s) => ({ infos: [...s.infos, { ...info, id } as ImportantInfo] }));
        return id;
      },
      updateInfo: (id, patch) =>
        set((s) => ({
          infos: s.infos.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      removeInfo: (id) => set((s) => ({ infos: s.infos.filter((i) => i.id !== id) })),
      addContact: (contact) => {
        const id = contact.id ?? uid("ctc");
        set((s) => ({ contacts: [...s.contacts, { ...contact, id } as FamilyContact] }));
        return id;
      },
      updateContact: (id, patch) =>
        set((s) => ({
          contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeContact: (id) =>
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      addCategory: (category) => {
        const id = category.id ?? uid("cat");
        set((s) => ({
          categories: [...s.categories, { ...category, id, builtin: false } as Category],
        }));
        return id;
      },
      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id && !c.builtin) })),
      resetDemo: () => set(() => createSeedState()),
      wipeAll: () => set(() => emptyFamily()),
      toggleCompleted: (key) =>
        set((s) => {
          const cur = s.settings.completedKeys ?? [];
          const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
          return { settings: { ...s.settings, completedKeys: next } };
        }),
    }),
    {
      name: "family-peps-v6-clean",
      version: 10,
      skipHydration: true,
      migrate: (persisted) => {
        const p = persisted as Partial<FamilyState> & {
          settings?: Partial<AppSettings>;
        };
        return {
          ...p,
          settings: {
            ...createSeedState().settings,
            ...p.settings,
            completedKeys: p.settings?.completedKeys ?? [],
          },
        };
      },
      partialize: (s) => ({
        settings: s.settings,
        categories: s.categories,
        members: s.members,
        events: s.events,
        tasks: s.tasks,
        activities: s.activities,
        schedules: s.schedules,
        documents: s.documents,
        notes: s.notes,
        infos: s.infos,
        contacts: s.contacts,
      }),
    },
  ),
);
