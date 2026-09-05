import type { FamilyDocument, FamilyMember, FamilyState, Schedule } from "./types";
import {
  createFamilyRow,
  fetchFamily,
  listFamilyAssets,
  pingCloud,
  putFamilyAsset,
  saveFamily,
} from "./cloud";
import { normalizeFamilyCode } from "./code";
import { useFamilyStore } from "./store";

const STATE_KEYS: (keyof FamilyState)[] = [
  "settings",
  "members",
  "events",
  "tasks",
  "activities",
  "schedules",
  "documents",
  "notes",
  "infos",
  "contacts",
  "categories",
];

const MAX_JSON = 1_200_000;
const ASSET_PREFIX = "asset:";

function snapshotState(s: FamilyState): FamilyState {
  const out = {} as FamilyState;
  for (const k of STATE_KEYS) {
    (out as Record<string, unknown>)[k] = s[k];
  }
  return out;
}

function mimeFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;]+)/);
  return m?.[1] || "image/jpeg";
}

function isDataUrl(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith("data:"));
}

function isAssetRef(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(ASSET_PREFIX));
}

function assetKey(code: string, kind: string, localId: string): string {
  return `${code}_${kind}_${localId}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
}

async function pushAssets(code: string, state: FamilyState): Promise<FamilyState> {
  const copy = structuredClone(snapshotState(state));
  const jobs: Array<Promise<void>> = [];

  const enqueue = (id: string, dataUrl: string) => {
    jobs.push(
      putFamilyAsset({
        data: { code, id, mimeType: mimeFromDataUrl(dataUrl), dataUrl },
      }).then(() => undefined),
    );
  };

  for (const m of copy.members) {
    if (isDataUrl(m.photo)) {
      const id = assetKey(code, "m", m.id);
      enqueue(id, m.photo);
      m.photo = ASSET_PREFIX + id;
    }
  }
  for (const sch of copy.schedules) {
    if (isDataUrl(sch.photo)) {
      const id = assetKey(code, "s", sch.id);
      enqueue(id, sch.photo);
      sch.photo = ASSET_PREFIX + id;
    }
  }
  for (const d of copy.documents) {
    if (isDataUrl(d.dataUrl) && d.dataUrl.length > 4000) {
      const id = assetKey(code, "d", d.id);
      enqueue(id, d.dataUrl);
      d.dataUrl = ASSET_PREFIX + id;
    }
  }

  if (jobs.length) {
    const chunk = 4;
    for (let i = 0; i < jobs.length; i += chunk) {
      await Promise.all(jobs.slice(i, i + chunk));
    }
  }
  return copy;
}

function compactForCloud(state: FamilyState): FamilyState {
  const copy = structuredClone(snapshotState(state));
  const json = JSON.stringify(copy);
  if (json.length <= MAX_JSON) return copy;
  copy.documents = copy.documents.map((d) =>
    d.dataUrl && d.dataUrl.length > 8000 && !d.dataUrl.startsWith(ASSET_PREFIX)
      ? { ...d, dataUrl: "" }
      : d,
  );
  return copy;
}

function resolveRef(
  value: string | null | undefined,
  assets: Map<string, string>,
  fallback?: string | null,
): string | null {
  if (!value) return fallback ?? null;
  if (isAssetRef(value)) {
    const id = value.slice(ASSET_PREFIX.length);
    return assets.get(id) ?? fallback ?? value;
  }
  if (value.startsWith("data:") && fallback?.startsWith("data:") && fallback.length > value.length) {
    return fallback;
  }
  return value;
}

function mergeDocuments(
  remote: FamilyDocument[],
  local: FamilyDocument[],
  assets: Map<string, string>,
): FamilyDocument[] {
  const localById = new Map(local.map((d) => [d.id, d]));
  return remote.map((d) => {
    const prev = localById.get(d.id);
    return { ...d, dataUrl: resolveRef(d.dataUrl, assets, prev?.dataUrl) ?? "" };
  });
}

function mergeMembers(
  remote: FamilyMember[],
  local: FamilyMember[],
  assets: Map<string, string>,
): FamilyMember[] {
  const localById = new Map(local.map((m) => [m.id, m]));
  return remote.map((m) => {
    const prev = localById.get(m.id);
    return { ...m, photo: resolveRef(m.photo, assets, prev?.photo) };
  });
}

function mergeSchedules(
  remote: Schedule[],
  local: Schedule[],
  assets: Map<string, string>,
): Schedule[] {
  const localById = new Map(local.map((s) => [s.id, s]));
  return remote.map((s) => {
    const prev = localById.get(s.id);
    return { ...s, photo: resolveRef(s.photo, assets, prev?.photo) };
  });
}

async function loadAssets(code: string): Promise<Map<string, string>> {
  try {
    const res = await listFamilyAssets({ data: { code } });
    return new Map((res.assets ?? []).map((a) => [a.id, a.dataUrl]));
  } catch {
    return new Map();
  }
}

function applyRemotePayload(payload: FamilyState, assets: Map<string, string>) {
  const local = useFamilyStore.getState();
  const nextSettings = {
    ...payload.settings,
    healthUnlocked: local.settings.healthUnlocked,
    currentMemberId:
      payload.settings?.currentMemberId ||
      local.settings.currentMemberId ||
      payload.members?.[0]?.id ||
      "",
    familyCode: local.settings.familyCode,
    cloudSync: local.settings.cloudSync,
  };
  useFamilyStore.setState({
    ...snapshotState(payload),
    members: mergeMembers(payload.members ?? [], local.members, assets),
    schedules: mergeSchedules(payload.schedules ?? [], local.schedules, assets),
    documents: mergeDocuments(payload.documents ?? [], local.documents, assets),
    settings: nextSettings,
  });
}

export function generateFamilyCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return `ZEN-${body}`;
}

export function shareFamilyUrl(code: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/?famille=${encodeURIComponent(normalizeFamilyCode(code))}`;
}

export type SyncStatus = "off" | "connecting" | "synced" | "error";

let pushing = false;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let unsubStore: (() => void) | null = null;
let statusListeners = new Set<(s: SyncStatus, msg?: string) => void>();
let currentStatus: SyncStatus = "off";
let lastRemoteStamp = "";

function setStatus(s: SyncStatus, msg?: string) {
  currentStatus = s;
  statusListeners.forEach((fn) => fn(s, msg));
}

export function getSyncStatus() {
  return currentStatus;
}

export function onSyncStatus(fn: (s: SyncStatus, msg?: string) => void) {
  statusListeners.add(fn);
  fn(currentStatus);
  return () => {
    statusListeners.delete(fn);
  };
}

export function isCloudConfigured(): boolean {
  return true;
}

export function cloudConfigHint(): string {
  return "OK";
}

export async function testCloudConnection(): Promise<
  { ok: true; url: string } | { error: string }
> {
  try {
    await pingCloud();
    return { ok: true, url: "cloud famille" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Connexion impossible" };
  }
}

function explainError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Réseau indisponible — réessayez dans un instant.";
  }
  return msg;
}

async function pushNow(code: string) {
  if (applyingRemote) return;
  pushing = true;
  try {
    const withAssets = await pushAssets(code, useFamilyStore.getState());
    const state = compactForCloud(withAssets);
    const res = await saveFamily({ data: { code, payload: state } });
    if (res.ok) {
      lastRemoteStamp = res.updatedAt;
      setStatus("synced");
    }
  } catch (e) {
    setStatus("error", explainError(e));
  } finally {
    pushing = false;
  }
}

function schedulePush(code: string) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushNow(code);
  }, 900);
}

export async function createFamilyCloud(): Promise<{ code: string } | { error: string }> {
  try {
    const state = compactForCloud(useFamilyStore.getState());
    const res = await createFamilyRow({ data: { payload: state } });
    if (!res.ok) return { error: res.error };
    useFamilyStore.getState().updateSettings({
      familyCode: res.code,
      cloudSync: true,
    });
    await startSync(res.code);
    void pushNow(res.code);
    return { code: res.code };
  } catch (e) {
    return { error: explainError(e) };
  }
}

export async function joinFamilyCloud(
  rawCode: string,
): Promise<{ ok: true } | { error: string }> {
  const code = normalizeFamilyCode(rawCode);
  if (!code) return { error: "Code vide" };
  try {
    const res = await fetchFamily({ data: { code } });
    if (!res.found) return { error: "Code introuvable" };
    const assets = await loadAssets(code);
    applyingRemote = true;
    try {
      applyRemotePayload(res.payload, assets);
      useFamilyStore.getState().updateSettings({ familyCode: code, cloudSync: true });
      lastRemoteStamp = res.updatedAt;
    } finally {
      applyingRemote = false;
    }
    await startSync(code);
    return { ok: true };
  } catch (e) {
    return { error: explainError(e) };
  }
}

export async function leaveFamilyCloud() {
  stopSync();
  useFamilyStore.getState().updateSettings({ familyCode: "", cloudSync: false });
  lastRemoteStamp = "";
  setStatus("off");
}

async function pullOnce(code: string) {
  if (pushing || applyingRemote) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  try {
    const res = await fetchFamily({ data: { code } });
    if (!res.found) {
      await pushNow(code);
      return;
    }
    if (res.updatedAt && res.updatedAt === lastRemoteStamp) {
      setStatus("synced");
      return;
    }
    const assets = await loadAssets(code);
    applyingRemote = true;
    try {
      applyRemotePayload(res.payload, assets);
      lastRemoteStamp = res.updatedAt;
    } finally {
      applyingRemote = false;
    }
    setStatus("synced");
  } catch (e) {
    setStatus("error", explainError(e));
  }
}

export async function startSync(code?: string) {
  const familyCode = normalizeFamilyCode(
    code || useFamilyStore.getState().settings.familyCode || "",
  );
  if (!familyCode || !useFamilyStore.getState().settings.cloudSync) {
    setStatus("off");
    return;
  }

  stopSync(false);
  setStatus("connecting");

  await pullOnce(familyCode);

  pollTimer = setInterval(() => {
    void pullOnce(familyCode);
  }, 4000);

  unsubStore = useFamilyStore.subscribe(() => {
    if (applyingRemote || pushing) return;
    const s = useFamilyStore.getState().settings;
    if (!s.cloudSync || !s.familyCode) return;
    schedulePush(s.familyCode);
  });
}

export function stopSync(updateStatus = true) {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (unsubStore) {
    unsubStore();
    unsubStore = null;
  }
  if (updateStatus) setStatus("off");
}

export function initCloudSync() {
  const { familyCode, cloudSync } = useFamilyStore.getState().settings;
  if (cloudSync && familyCode) {
    void startSync(familyCode);
  }
}
