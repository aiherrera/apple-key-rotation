import { useState, useEffect, useCallback } from "react";

export interface RotationRecord {
  id: string;
  rotated_at: string;
  expires_at: string;
  status: "success" | "failed";
  error_message: string | null;
  triggered_by: "manual" | "cron";
}

/** IndexedDB database name for rotation history (also deleted by clear-all-data). */
export const ROTATION_IDB_NAME = "apple-key-rotation";
const STORE_NAME = "rotations";
const DB_VERSION = 1;

/** Exported for tests. */
export function takeLatestRotations(
  records: RotationRecord[],
  limit: number,
): RotationRecord[] {
  return [...records]
    .sort((a, b) => new Date(b.rotated_at).getTime() - new Date(a.rotated_at).getTime())
    .slice(0, limit);
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

export function useRotationHistory() {
  const [rotations, setRotations] = useState<RotationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRotations = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as RotationRecord[];
        setRotations(takeLatestRotations(records, 10));
        setIsLoading(false);
      };

      request.onerror = () => {
        console.error("Failed to fetch rotations:", request.error);
        setIsLoading(false);
      };
    } catch (error) {
      console.error("Failed to open DB:", error);
      setIsLoading(false);
    }
  }, []);

  const addRotation = useCallback(async (record: Omit<RotationRecord, "id">) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const newRecord: RotationRecord = {
        ...record,
        id: createRandomId(),
      };

      store.add(newRecord);

      transaction.oncomplete = () => {
        fetchRotations();
      };

      return newRecord;
    } catch (error) {
      console.error("Failed to add rotation:", error);
      throw error;
    }
  }, [fetchRotations]);

  const clearHistory = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.clear();

      transaction.oncomplete = () => {
        setRotations([]);
      };
    } catch (error) {
      console.error("Failed to clear history:", error);
      throw error;
    }
  }, []);

  const exportHistory = useCallback(() => {
    const dataStr = JSON.stringify(rotations, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `apple-key-rotations-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [rotations]);

  useEffect(() => {
    fetchRotations();
  }, [fetchRotations]);

  return {
    rotations,
    isLoading,
    addRotation,
    clearHistory,
    exportHistory,
    refetch: fetchRotations,
  };
}
