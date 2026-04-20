import { useState, useEffect, useCallback, useMemo } from "react";
import type { PersistedRotationRow } from "@/lib/persistedRotation";
import { hasElectronSqlite } from "@/lib/isElectronApp";

export type RotationRecord = {
  id: string;
  profile_id: string;
  rotated_at: string;
  expires_at: string;
  status: "success" | "failed";
  error_message: string | null;
  triggered_by: "manual" | "cron";
  jwt: string | null;
  key_id: string | null;
  team_id: string | null;
  services_id: string | null;
};

export type AddRotationInput = {
  rotated_at: string;
  expires_at: string;
  status: "success" | "failed";
  error_message: string | null;
  triggered_by: "manual" | "cron";
  jwt?: string | null;
  profile_id?: string;
  key_id?: string;
  team_id?: string;
  services_id?: string;
};

/** IndexedDB database name for rotation history (web build; deleted by clear-all-data). */
export const ROTATION_IDB_NAME = "apple-key-rotation";
const STORE_NAME = "rotations";
const DB_VERSION = 1;

const FETCH_LIMIT_WEB = 2000;
const FETCH_LIMIT_ELECTRON = 5000;
const UI_PREVIEW_LIMIT = 10;

/** Exported for tests. */
export function takeLatestRotations(
  records: RotationRecord[],
  limit: number,
): RotationRecord[] {
  return [...records]
    .sort((a, b) => new Date(b.rotated_at).getTime() - new Date(a.rotated_at).getTime())
    .slice(0, limit);
}

function persistedToRecord(row: PersistedRotationRow): RotationRecord {
  return {
    id: row.id,
    profile_id: row.profile_id,
    rotated_at: row.rotated_at,
    expires_at: row.expires_at,
    status: row.status as RotationRecord["status"],
    error_message: row.error_message,
    triggered_by: row.triggered_by as RotationRecord["triggered_by"],
    jwt: row.jwt,
    key_id: row.key_id,
    team_id: row.team_id,
    services_id: row.services_id,
  };
}

/** UUID v4; works when `crypto.randomUUID` is missing (HTTP, older browsers). */
function createRandomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function normalizeIdbRecord(raw: unknown): RotationRecord {
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : createRandomId();
  const rotated_at = typeof r.rotated_at === "string" ? r.rotated_at : new Date().toISOString();
  const expires_at = typeof r.expires_at === "string" ? r.expires_at : rotated_at;
  const status = r.status === "failed" ? "failed" : "success";
  const error_message =
    r.error_message === null || typeof r.error_message === "string" ? r.error_message : null;
  const triggered_by = r.triggered_by === "cron" ? "cron" : "manual";
  return {
    id,
    profile_id: typeof r.profile_id === "string" ? r.profile_id : "",
    rotated_at,
    expires_at,
    status,
    error_message,
    triggered_by,
    jwt: typeof r.jwt === "string" ? r.jwt : null,
    key_id: typeof r.key_id === "string" ? r.key_id : null,
    team_id: typeof r.team_id === "string" ? r.team_id : null,
    services_id: typeof r.services_id === "string" ? r.services_id : null,
  };
}

function openDB(): Promise<IDBDatabase> {
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

function useIsElectronSqlite(): boolean {
  return useMemo(() => hasElectronSqlite(), []);
}

export function useRotationHistory() {
  const isElectronSqlite = useIsElectronSqlite();
  const [allRotations, setAllRotations] = useState<RotationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const rotations = useMemo(
    () => takeLatestRotations(allRotations, UI_PREVIEW_LIMIT),
    [allRotations],
  );

  const fetchRotations = useCallback(async () => {
    try {
      if (isElectronSqlite && window.electronAPI?.sqlite) {
        const rows = await window.electronAPI.sqlite.listRotations({
          limit: FETCH_LIMIT_ELECTRON,
          offset: 0,
        });
        setAllRotations(rows.map(persistedToRecord));
        setIsLoading(false);
        return;
      }

      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawList = (request.result as unknown[]) ?? [];
        const records = rawList.map(normalizeIdbRecord);
        setAllRotations(takeLatestRotations(records, FETCH_LIMIT_WEB));
        setIsLoading(false);
      };

      request.onerror = () => {
        console.error("Failed to fetch rotations:", request.error);
        setIsLoading(false);
      };
    } catch (error) {
      console.error("Failed to fetch rotations:", error);
      setIsLoading(false);
    }
  }, [isElectronSqlite]);

  const addRotation = useCallback(
    async (record: AddRotationInput) => {
      const newRecord: RotationRecord = {
        rotated_at: record.rotated_at,
        expires_at: record.expires_at,
        status: record.status,
        error_message: record.error_message,
        triggered_by: record.triggered_by,
        id: createRandomId(),
        profile_id: record.profile_id ?? "",
        jwt: record.jwt ?? null,
        key_id: record.key_id ?? null,
        team_id: record.team_id ?? null,
        services_id: record.services_id ?? null,
      };

      if (isElectronSqlite && window.electronAPI?.sqlite) {
        const row: PersistedRotationRow = {
          id: newRecord.id,
          profile_id: newRecord.profile_id,
          rotated_at: newRecord.rotated_at,
          expires_at: newRecord.expires_at,
          status: newRecord.status,
          error_message: newRecord.error_message,
          triggered_by: newRecord.triggered_by,
          jwt: newRecord.jwt,
          key_id: newRecord.key_id,
          team_id: newRecord.team_id,
          services_id: newRecord.services_id,
        };
        await window.electronAPI.sqlite.addRotation(row);
        await fetchRotations();
        return newRecord;
      }

      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.add(newRecord);

      return await new Promise<RotationRecord>((resolve, reject) => {
        transaction.oncomplete = () => {
          void fetchRotations();
          resolve(newRecord);
        };
        transaction.onerror = () => reject(transaction.error ?? new Error("IDB write failed"));
      });
    },
    [isElectronSqlite, fetchRotations],
  );

  const clearHistory = useCallback(async () => {
    if (isElectronSqlite && window.electronAPI?.sqlite) {
      await window.electronAPI.sqlite.clearRotations();
      setAllRotations([]);
      return;
    }

    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();

    return await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        setAllRotations([]);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error ?? new Error("IDB clear failed"));
    });
  }, [isElectronSqlite]);

  const exportHistory = useCallback(() => {
    const dataStr = JSON.stringify(allRotations, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `apple-key-rotations-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [allRotations]);

  useEffect(() => {
    void fetchRotations();
  }, [fetchRotations]);

  return {
    rotations,
    allRotations,
    isLoading,
    addRotation,
    clearHistory,
    exportHistory,
    refetch: fetchRotations,
  };
}
