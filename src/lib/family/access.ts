import type { FamilyMember, MemberRole } from "./types";

export function canSeeParentOnly(role: MemberRole | undefined | null): boolean {
  return role === "parent" || role === "autre";
}

export function currentMemberRole(
  members: FamilyMember[],
  currentMemberId: string,
): MemberRole | undefined {
  return members.find((m) => m.id === currentMemberId)?.role;
}

export function isChildViewer(
  members: FamilyMember[],
  currentMemberId: string,
): boolean {
  return currentMemberRole(members, currentMemberId) === "enfant";
}
