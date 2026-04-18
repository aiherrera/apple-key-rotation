import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";
import {
  type AppSettings,
  defaultAppSettings,
  loadAppSettings,
  saveAppSettings,
} from "@/lib/appSettings";

export type AppSettingsApi = {
  settings: AppSettings;
  setSettings: (next: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
};

export const AppSettingsContext = createContext<AppSettingsApi | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(loadAppSettings);

  const setSettings = useCallback((next: AppSettings | ((prev: AppSettings) => AppSettings)) => {
    setSettingsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveAppSettings(resolved);
      return resolved;
    });
  }, []);

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
