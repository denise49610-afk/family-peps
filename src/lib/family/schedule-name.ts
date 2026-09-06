import type { MemberRole } from "./types";

/**
 * Nom par défaut d'un planning selon le rôle du membre.
 * Reste 100% modifiable à la main ensuite (champ "Nom du planning").
 */
export function defaultPlanningName(role?: MemberRole | string | null): string {
  if (role === "enfant") return "Planning école";
  if (role === "parent") return "Planning travail";
  return "Emploi du temps";
}
