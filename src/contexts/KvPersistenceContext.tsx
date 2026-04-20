import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { APP_LOCAL_STORAGE_KEYS } from "@/lib/clearAppData";
import {
  clearLegacyBrowserStorage,
  collectLegacyLocalStorageKv,
  legacyRotationToPersistedRow,
  readAllLegacyRotationsFromIdb,
} from "@/lib/persistence/legacyBrowserExport";
import { hasElectronSqlite } from "@/lib/isElectronApp";

function loadWebKv(): Record<string, string> {
  const kv: Record<string, string> = {};
  for (const key of APP_LOCAL_STORAGE_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) {
      kv[key] = v;
    }
  }
  return kv;
}

export type KvPersistenceApi = {
  /** Current key-value snapshot (settings, profiles, etc.). */
  kv: Record<string, string>;
  getItem: (key: string) => string | undefined;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const KvPersistenceContext = createContext<KvPersistenceApi | null>(null);

export function KvPersistenceProvider({ children }: { children: ReactNode }) {
  const [kv, setKv] = useState<Record<string, string> | null>(() =>
    hasElectronSqlite() ? null : loadWebKv(),
  );

  useEffect(() => {
    if (!hasElectronSqlite()) return;

    let cancelled = false;

    void (async () => {
      const api = window.electronAPI?.sqlite;
      if (!api) {
        if (!cancelled) setKv(loadWebKv());
        return;
      }

      try {
        if (await api.isEmpty()) {
          const legacyKv = collectLegacyLocalStorageKv();
          const legacyRotations = await readAllLegacyRotationsFromIdb();
          const rows = legacyRotations.map(legacyRotationToPersistedRow);
          if (Object.keys(legacyKv).length > 0 || rows.length > 0) {
            await api.migrateLegacy({ kv: legacyKv, rotations: rows });
            clearLegacyBrowserStorage();
          }
        }
        const data = await api.getAllKv();
        if (!cancelled) setKv(data);
      } catch (e) {
        console.error("[KvPersistence] bootstrap failed", e);
        if (!cancelled) setKv(loadWebKv());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const getItem = useCallback(
    (key: string) => {
      if (!kv) return undefined;
      return kv[key];
    },
    [kv],
  );

  const setItem = useCallback((key: string, value: string) => {
    if (hasElectronSqlite()) {
      void window.electronAPI!.sqlite!.setKv(key, value);
    } else {
      localStorage.setItem(key, value);
    }
    setKv((prev) => {
      if (!prev) return { [key]: value };
      return { ...prev, [key]: value };
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    if (hasElectronSqlite()) {
      void window.electronAPI!.sqlite!.removeKv(key);
    } else {
      localStorage.removeItem(key);
    }
    setKv((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo(
    () =>
      kv
        ? {
            kv,
            getItem,
            setItem,
            removeItem,
          }
        : null,
    [kv, getItem, setItem, removeItem],
  );

  if (!value) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading local data…
      </div>
    );
  }

  return <KvPersistenceContext.Provider value={value}>{children}</KvPersistenceContext.Provider>;
}

export function useKvPersistence(): KvPersistenceApi {
  const ctx = useContext(KvPersistenceContext);
  if (!ctx) {
    throw new Error("useKvPersistence must be used within KvPersistenceProvider");
  }
  return ctx;
}
