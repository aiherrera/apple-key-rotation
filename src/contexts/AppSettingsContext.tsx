import { createContext, useCallback, useMemo, type ReactNode } from "react";
import {
  type AppSettings,
  APP_SETTINGS_STORAGE_KEY,
  defaultAppSettings,
  parseAppSettings,
} from "@/lib/appSettings";
import { useKvPersistence } from "@/contexts/KvPersistenceContext";

export type AppSettingsApi = {
  settings: AppSettings;
  setSettings: (next: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
};

export const AppSettingsContext = createContext<AppSettingsApi | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { kv, setItem } = useKvPersistence();
  const settingsBlob = kv[APP_SETTINGS_STORAGE_KEY];

  const settings = useMemo(() => {
    if (!settingsBlob) return { ...defaultAppSettings };
    try {
      return parseAppSettings(JSON.parse(settingsBlob) as unknown);
    } catch {
      return { ...defaultAppSettings };
    }
  }, [settingsBlob]);

  const setSettings = useCallback(
    (next: AppSettings | ((prev: AppSettings) => AppSettings)) => {
      const raw = kv[APP_SETTINGS_STORAGE_KEY];
      const prev = raw
        ? parseAppSettings(JSON.parse(raw) as unknown)
        : { ...defaultAppSettings };
      const resolved = typeof next === "function" ? next(prev) : next;
      setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(resolved));
    },
    [setItem, kv],
  );

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [setSettings],
  );

  const resetSettings = useCallback(() => {
    setSettings({ ...defaultAppSettings });
  }, [setSettings]);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      updateSettings,
      resetSettings,
    }),
    [settings, setSettings, updateSettings, resetSettings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}
