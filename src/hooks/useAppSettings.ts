import { useContext } from "react";
import { AppSettingsContext, type AppSettingsApi } from "@/contexts/AppSettingsContext";

export function useAppSettings(): AppSettingsApi {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}
