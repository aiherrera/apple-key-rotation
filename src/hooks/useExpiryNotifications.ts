import { useEffect, useRef } from "react";
import { useInAppNotifications } from "@/contexts/InAppNotificationsContext";
import { useKvPersistence } from "@/contexts/KvPersistenceContext";
import type { AppSettings } from "@/lib/appSettings";
import {
  buildNotificationContent,
  computePendingThresholds,
  getCeiledDaysRemaining,
  EXPIRY_NOTIFICATION_STATE_KEY,
  mergeFiredThresholds,
  type ExpiryNotificationState,
} from "@/lib/expiryNotifications";
import type { RotationRecord } from "@/hooks/useRotationHistory";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function findLatestSuccess(rotations: RotationRecord[]): RotationRecord | undefined {
  return rotations.find((r) => r.status === "success");
}

function parseExpiryState(raw: string | undefined): ExpiryNotificationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "expiresAt" in parsed &&
      "firedThresholds" in parsed &&
      typeof (parsed as { expiresAt: unknown }).expiresAt === "string" &&
      Array.isArray((parsed as { firedThresholds: unknown }).firedThresholds)
    ) {
      return {
        expiresAt: (parsed as ExpiryNotificationState).expiresAt,
        firedThresholds: (parsed as ExpiryNotificationState).firedThresholds.filter(
          (n): n is number => typeof n === "number",
        ),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function useExpiryNotifications(
  rotations: RotationRecord[],
  isLoading: boolean,
  settings: AppSettings,
): void {
  const { add: addInApp } = useInAppNotifications();
  const { kv, setItem } = useKvPersistence();

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const rotationsRef = useRef(rotations);
  rotationsRef.current = rotations;

  const addInAppRef = useRef(addInApp);
  addInAppRef.current = addInApp;

  const kvRef = useRef(kv);
  kvRef.current = kv;
  const setItemRef = useRef(setItem);
  setItemRef.current = setItem;

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

      const k = kvRef.current;
      let state = parseExpiryState(k[EXPIRY_NOTIFICATION_STATE_KEY]);
      if (!state || state.expiresAt !== latest.expires_at) {
        state = { expiresAt: latest.expires_at, firedThresholds: [] };
        setItemRef.current(EXPIRY_NOTIFICATION_STATE_KEY, JSON.stringify(state));
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

      addInAppRef.current({
        kind: "expiry_reminder",
        title,
        body,
      });

      const next: typeof state = {
        expiresAt: state.expiresAt,
        firedThresholds: mergeFiredThresholds(state.firedThresholds, pending),
      };
      setItemRef.current(EXPIRY_NOTIFICATION_STATE_KEY, JSON.stringify(next));
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
