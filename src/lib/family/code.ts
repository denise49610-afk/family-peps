const CODE_RE = /^[A-Z0-9]{2,8}-[A-Z0-9]{4,10}$/;

export function normalizeFamilyCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isFamilyCode(code: string): boolean {
  return CODE_RE.test(normalizeFamilyCode(code));
}
