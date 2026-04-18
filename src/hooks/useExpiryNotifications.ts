import { useEffect, useRef } from "react";
import type { AppSettings } from "@/lib/appSettings";
import {
  buildNotificationContent,
  computePendingThresholds,
  getCeiledDaysRemaining,
  loadExpiryNotificationState,
  mergeFiredThresholds,
  saveExpiryNotificationState,
} from "@/lib/expiryNotifications";
import type { RotationRecord } from "@/hooks/useRotationHistory";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function findLatestSuccess(rotations: RotationRecord[]): RotationRecord | undefined {
  return rotations.find((r) => r.status === "success");
}

export function useExpiryNotifications(
  rotations: RotationRecord[],
  isLoading: boolean,
  settings: AppSettings,
): void {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const rotationsRef = useRef(rotations);
  rotationsRef.current = rotations;

  useEffect(() => {
    if (isLoading) return;

    const runCheck = (): void => {
      const s = settingsRef.current;
      if (!s.expiryNotificationsEnabled) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      const latest = findLatestSuccess(rotationsRef.current);
      if (!latest) {
        return;
      }

      let state = loadExpiryNotificationState();
      if (!state || state.expiresAt !== latest.expires_at) {
        state = { expiresAt: latest.expires_at, firedThresholds: [] };
        saveExpiryNotificationState(state);
      }

      const now = new Date();
      const pending = computePendingThresholds(
        latest.expires_at,
        now,
        s.expiryNotificationThresholds,
        state.firedThresholds,
      );

      if (pending.length === 0) return;

      const days = getCeiledDaysRemaining(latest.expires_at, now);
      const { title, body } = buildNotificationContent(days, pending);
      if (!title || !body) return;

      try {
        new Notification(title, { body });
      } catch {
        return;
      }

      const next: typeof state = {
        expiresAt: state.expiresAt,
        firedThresholds: mergeFiredThresholds(state.firedThresholds, pending),
      };
      saveExpiryNotificationState(next);
    };

    runCheck();

    const interval = window.setInterval(runCheck, CHECK_INTERVAL_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        runCheck();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLoading, rotations, settings]);
}
