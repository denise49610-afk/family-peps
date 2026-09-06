import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { createSeedState } from "./seed";
import {
  type Activity,
  type AppSettings,
  type Category,
  type FamilyContact,
  type FamilyDocument,
  type FamilyEvent,
  type FamilyMember,
  type FamilyNote,
  type FamilyState,
  type FamilyTask,
  type ImportantInfo,
  type Schedule,
} from "./types";

type FamilyActions = {
  updateSettings: (patch: Partial<AppSettings>) => void;
  addMember: (member: Omit<FamilyMember, "id"> & { id?: string }) => string;
  updateMember: (id: string, patch: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;
  addEvent: (event: Omit<FamilyEvent, "id"> & { id?: string }) => string;
  updateEvent: (id: string, patch: Partial<FamilyEvent>) => void;
  removeEvent: (id: string) => void;
  moveEvent: (id: string, date: string) => void;
  addTask: (task: Omit<FamilyTask, "id" | "createdAt"> & { id?: string }) => string;
  updateTask: (id: string, patch: Partial<FamilyTask>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  addActivity: (activity: Omit<Activity, "id"> & { id?: string }) => string;
  updateActivity: (id: string, patch: Partial<Activity>) => void;
  removeActivity: (id: string) => void;
  addSchedule: (schedule: Omit<Schedule, "id"> & { id?: string }) => string;
  upsertScheduleForMember: (schedule: Omit<Schedule, "id"> & { id?: string }) => string;
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
      ...createSeedState(),
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      addMember: (member) => {
        const id = member.id ?? uid("member");
        set((s) => ({ members: [...s.members, { ...member, id }] }));
        return id;
      },
      updateMember: (id, patch) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMember: (id) => {
        const { members, settings } = get();
        if (members.length <= 1) return;
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          events: s.events.map((e) => ({
            ...e,
            memberIds: e.memberIds.filter((mid) => mid !== id),
          })),
          tasks: s.tasks.map((t) => ({
            ...t,
            assigneeId: t.assigneeId === id ? null : t.assigneeId,
          })),
          activities: s.activities.map((a) => ({
            ...a,
            memberIds: a.memberIds.filter((mid) => mid !== id),
          })),
          schedules: s.schedules.filter((sch) => sch.memberId !== id),
          contacts: s.contacts.filter((c) => c.memberId !== id),
          documents: s.documents.map((d) => ({
            ...d,
            memberId: d.memberId === id ? null : d.memberId,
          })),
          notes: s.notes.map((n) => ({
            ...n,
            memberId: n.memberId === id ? null : n.memberId,
          })),
          settings: {
            ...s.settings,
            currentMemberId:
              settings.currentMemberId === id
                ? s.members.find((m) => m.id !== id)?.id ?? ""
                : s.settings.currentMemberId,
          },
        }));
      },
      addEvent: (event) => {
        const id = event.id ?? uid("evt");
        set((s) => ({ events: [...s.events, { ...event, id }] }));
        return id;
      },
      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      moveEvent: (id, date) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, date } : e)),
        })),
      addTask: (task) => {
        const id = task.id ?? uid("task");
        set((s) => ({
          tasks: [
            ...s.tasks,
            { ...task, id, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: t.status === "done" ? "todo" : "done",
                  completedAt:
                    t.status === "done" ? null : new Date().toISOString(),
                }
              : t,
          ),
        })),
      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      addActivity: (activity) => {
        const id = activity.id ?? uid("act");
        set((s) => ({ activities: [...s.activities, { ...activity, id }] }));
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
        set((s) => ({ schedules: [...s.schedules, { ...schedule, id }] }));
        return id;
      },
      upsertScheduleForMember: (schedule) => {
        const existing = get().schedules.find((sch) => sch.memberId === schedule.memberId);
        const id = schedule.id ?? existing?.id ?? uid("sch");
        set((s) => ({
          schedules: [
            ...s.schedules.filter((sch) => sch.memberId !== schedule.memberId),
            { ...schedule, id },
          ],
        }));
        return id;
      },
      updateSchedule: (id, patch) =>
        set((s) => ({
          schedules: s.schedules.map((sch) =>
            sch.id === id ? { ...sch, ...patch } : sch,
          ),
        })),
      removeSchedule: (id) =>
        set((s) => ({ schedules: s.schedules.filter((sch) => sch.id !== id) })),
      addDocument: (doc) => {
        const id = doc.id ?? uid("doc");
        set((s) => ({
          documents: [
            ...s.documents,
            { ...doc, id, createdAt: new Date().toISOString() },
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
            { ...note, id, createdAt: new Date().toISOString(), reactions: note.reactions ?? [] },
          ],
        }));
        return id;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      removeNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      toggleNoteReaction: (id, emoji, memberId) =>
        set((s) => ({
          notes: s.notes.map((n) => {
            if (n.id !== id) return n;
            const current = n.reactions ?? [];
            const found = current.find((r) => r.emoji === emoji);
            if (!found) {
              return {
                ...n,
                reactions: [...current, { emoji, memberIds: [memberId] }],
              };
            }
            const has = found.memberIds.includes(memberId);
            const nextIds = has
              ? found.memberIds.filter((m) => m !== memberId)
              : [...found.memberIds, memberId];
            const next = nextIds.length
              ? current.map((r) => (r.emoji === emoji ? { ...r, memberIds: nextIds } : r))
              : current.filter((r) => r.emoji !== emoji);
            return { ...n, reactions: next };
          }),
        })),
      addInfo: (info) => {
        const id = info.id ?? uid("info");
        set((s) => ({ infos: [...s.infos, { ...info, id }] }));
        return id;
      },
      updateInfo: (id, patch) =>
        set((s) => ({
          infos: s.infos.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      removeInfo: (id) =>
        set((s) => ({ infos: s.infos.filter((i) => i.id !== id) })),
      addContact: (contact) => {
        const id = contact.id ?? uid("ct");
        set((s) => ({ contacts: [...s.contacts, { ...contact, id }] }));
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
          categories: [...s.categories, { ...category, id, builtin: false }],
        }));
        return id;
      },
      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),
      removeCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => !(c.id === id && !c.builtin)),
        })),
      resetDemo: () => set(() => createSeedState()),
      wipeAll: () => set(() => emptyFamily()),
      toggleCompleted: (key) =>
        set((s) => {
          const cur = s.settings.completedKeys ?? [];
          const next = cur.includes(key)
            ? cur.filter((k) => k !== key)
            : [...cur, key];
          return { settings: { ...s.settings, completedKeys: next } };
        }),
    }),
    {
      name: "family-peps-v6-clean",
      version: 10,
      skipHydration: true,
      // Stockage "sûr" : si le quota localStorage est dépassé (ex. photo trop lourde),
      // on avale l'erreur au lieu de la laisser remonter — sinon l'appelant (ex. addActivity)
      // pense que l'ajout a échoué, retente avec une version allégée, et l'activité se
      // retrouve dupliquée en mémoire (le premier ajout avait pourtant déjà eu lieu).
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (err) {
            console.warn("Sauvegarde locale impossible (stockage plein) :", err);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      migrate: (persisted) => {
        const p = persisted as Partial<FamilyState> & { settings?: Partial<FamilyState["settings"]> };
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
        notes: [],
        infos: s.infos,
        contacts: s.contacts,
      }),
    },
  ),
);
