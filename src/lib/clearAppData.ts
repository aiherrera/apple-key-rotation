import { APP_SETTINGS_STORAGE_KEY } from "@/lib/appSettings";
import { EXPIRY_NOTIFICATION_STATE_KEY } from "@/lib/expiryNotifications";
import { IN_APP_NOTIFICATIONS_STORAGE_KEY } from "@/lib/inAppNotifications";
import {
  ACTIVE_KEY,
  LEGACY_KEY_ID,
  LEGACY_SERVICES_ID,
  LEGACY_TEAM_ID,
  PROFILES_KEY,
} from "@/hooks/useProfiles";
import { ROTATION_IDB_NAME } from "@/hooks/useRotationHistory";
import { hasElectronSqlite } from "@/lib/isElectronApp";

/** All localStorage keys owned by this app (keep in sync with hooks/lib). */
export const APP_LOCAL_STORAGE_KEYS = [
  APP_SETTINGS_STORAGE_KEY,
  PROFILES_KEY,
  ACTIVE_KEY,
  LEGACY_KEY_ID,
  LEGACY_TEAM_ID,
  LEGACY_SERVICES_ID,
  EXPIRY_NOTIFICATION_STATE_KEY,
  IN_APP_NOTIFICATIONS_STORAGE_KEY,
] as const;

export type ClearAppDataDeps = {
  removeLocalStorageItem: (key: string) => void;
  deleteDatabase: (name: string) => IDBOpenDBRequest;
  reload: () => void;
};

export function getDefaultClearAppDataDeps(): ClearAppDataDeps {
  return {
    removeLocalStorageItem: (key) => localStorage.removeItem(key),
    deleteDatabase: (name) => indexedDB.deleteDatabase(name),
    reload: () => {
      window.location.reload();
    },
  };
}

function deleteIndexedDb(
  name: string,
  deleteDatabase: (n: string) => IDBOpenDBRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("IndexedDB delete failed"));
  });
}

/** Removes app data: SQLite (Electron), localStorage keys, rotation IndexedDB (web), then reloads. */
export async function clearAllAppData(
  deps: ClearAppDataDeps = getDefaultClearAppDataDeps(),
): Promise<void> {
  if (hasElectronSqlite()) {
    await window.electronAPI!.sqlite!.clearAllUserData();
  }
  for (const key of APP_LOCAL_STORAGE_KEYS) {
    deps.removeLocalStorageItem(key);
  }
  await deleteIndexedDb(ROTATION_IDB_NAME, deps.deleteDatabase);
  deps.reload();
}
