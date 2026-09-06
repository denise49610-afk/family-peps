import type { StateStorage } from "zustand/middleware";

/**
 * Stockage local basé sur IndexedDB (au lieu de localStorage).
 *
 * Pourquoi : localStorage est limité à ~5 Mo par site. Dès qu'une famille
 * importe plusieurs plannings avec photo (un par enfant/parent), le total
 * dépasse vite cette limite : l'écriture échoue silencieusement et les
 * dernières modifications (ex : "Confirmer" un planning importé) semblent
 * fonctionner à l'écran mais ne sont jamais réellement enregistrées.
 *
 * IndexedDB n'a pas cette limite basse (des centaines de Mo, généralement).
 * On garde localStorage comme filet de sécurité : si IndexedDB n'est pas
 * disponible (vieux navigateur, mode privé strict…), on retombe dessus.
 */

const DB_NAME = "peps-family-db";
const STORE_NAME = "kv";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
let idbUnavailable = false;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB : ouverture impossible"));
    req.onblocked = () => reject(new Error("IndexedDB : bloqué"));
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB : opération impossible"));
  });
}

function safeLocalStorageGet(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(name: string, value: string) {
  try {
    localStorage.setItem(name, value);
  } catch {
    // Rien de plus à faire : si même le fallback échoue, on abandonne
    // silencieusement plutôt que de casser l'app.
  }
}

function safeLocalStorageRemove(name: string) {
  try {
    localStorage.removeItem(name);
  } catch {
    // ignore
  }
}

export const idbStorage: StateStorage = {
  async getItem(name) {
    if (typeof window === "undefined") return null;
    if (idbUnavailable) return safeLocalStorageGet(name);
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readonly");
      const value = await request<string | undefined>(tx.objectStore(STORE_NAME).get(name));
      if (value !== undefined) return value;
      // Migration douce : si rien en IndexedDB, on regarde l'ancien localStorage
      // (utilisé par les versions précédentes de l'app) pour ne rien perdre.
      return safeLocalStorageGet(name);
    } catch {
      idbUnavailable = true;
      return safeLocalStorageGet(name);
    }
  },
  async setItem(name, value) {
    if (typeof window === "undefined") return;
    if (idbUnavailable) {
      safeLocalStorageSet(name, value);
      return;
    }
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      await request(tx.objectStore(STORE_NAME).put(value, name));
      // Une fois migré vers IndexedDB, on vide l'ancienne copie localStorage
      // pour ne pas garder deux exemplaires volumineux et pour libérer le quota.
      safeLocalStorageRemove(name);
    } catch {
      idbUnavailable = true;
      safeLocalStorageSet(name, value);
    }
  },
  async removeItem(name) {
    if (typeof window === "undefined") return;
    safeLocalStorageRemove(name);
    if (idbUnavailable) return;
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      await request(tx.objectStore(STORE_NAME).delete(name));
    } catch {
      idbUnavailable = true;
    }
  },
};
