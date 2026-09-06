import type { Category, FamilyState } from "./types";
import { CAT } from "./ids";

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

/**
 * App vide : rien d'inventé.
 * L'utilisateur ajoute sa famille et ses vrais plannings, RDV, activités, tâches.
 */
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

/** Alias : plus de démo préremplie. */
export function createShowcaseState(): FamilyState {
  return createSeedState();
}
