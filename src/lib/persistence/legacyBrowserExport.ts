import { APP_LOCAL_STORAGE_KEYS } from "@/lib/clearAppData";
import { ROTATION_IDB_NAME } from "@/hooks/useRotationHistory";
import type { PersistedRotationRow } from "@/lib/persistedRotation";

const STORE_NAME = "rotations";
const DB_VERSION = 1;

/** Legacy rotation shape from IndexedDB before SQLite (no jwt / profile_id). */
export type LegacyIndexedDbRotation = {
  id: string;
  rotated_at: string;
  expires_at: string;
  status: "success" | "failed";
  error_message: string | null;
  triggered_by: "manual" | "cron";
};

function openRotationDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ROTATION_IDB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("rotated_at", "rotated_at", { unique: false });
      }
    };
  });
}

export async function readAllLegacyRotationsFromIdb(): Promise<LegacyIndexedDbRotation[]> {
  try {
    const db = await openRotationDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve((req.result as LegacyIndexedDbRotation[]) ?? []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export function legacyRotationToPersistedRow(
  r: LegacyIndexedDbRotation,
): PersistedRotationRow {
  return {
    id: r.id,
    profile_id: "",
    rotated_at: r.rotated_at,
    expires_at: r.expires_at,
    status: r.status,
    error_message: r.error_message,
    triggered_by: r.triggered_by,
    jwt: null,
    key_id: null,
    team_id: null,
    services_id: null,
  };
}

export function collectLegacyLocalStorageKv(): Record<string, string> {
  const kv: Record<string, string> = {};
  for (const key of APP_LOCAL_STORAGE_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) {
      kv[key] = v;
    }
  }
  return kv;
}

export function clearLegacyBrowserStorage(): void {
  for (const key of APP_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  indexedDB.deleteDatabase(ROTATION_IDB_NAME);
}
