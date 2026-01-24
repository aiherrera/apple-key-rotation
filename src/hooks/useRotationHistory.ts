import { useState, useEffect, useCallback } from "react";

export interface RotationRecord {
  id: string;
  rotated_at: string;
  expires_at: string;
  status: "success" | "failed";
  error_message: string | null;
  triggered_by: "manual" | "cron";
}

const DB_NAME = "apple-key-rotation";
const STORE_NAME = "rotations";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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
        // Sort by rotated_at descending, limit to 10
        records.sort((a, b) => new Date(b.rotated_at).getTime() - new Date(a.rotated_at).getTime());
        setRotations(records.slice(0, 10));
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
        id: crypto.randomUUID(),
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
