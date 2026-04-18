/** Pure helpers for expiry reminders (OS notifications + tests). */

export type ExpiryNotificationState = {
  expiresAt: string;
  firedThresholds: number[];
};

export const EXPIRY_NOTIFICATION_STATE_KEY = "expiry_notification_state_v1";

export function getCeiledDaysRemaining(expiresAtIso: string, now: Date): number {
  const exp = new Date(expiresAtIso).getTime();
  return Math.ceil((exp - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Which enabled thresholds still need a notification for this secret.
 * A threshold T fires when days remaining is <= T and not yet recorded in firedThresholds.
 */
export function computePendingThresholds(
  expiresAtIso: string,
  now: Date,
  enabledThresholds: readonly number[],
  firedThresholds: readonly number[],
): number[] {
  const days = getCeiledDaysRemaining(expiresAtIso, now);
  if (days <= 0) return [];

  const enabled = [...new Set(enabledThresholds)].sort((a, b) => b - a);
  const pending: number[] = [];
  for (const T of enabled) {
    if (days <= T && !firedThresholds.includes(T)) {
      pending.push(T);
    }
  }
  return pending.sort((a, b) => a - b);
}

export function shouldBatchNotify(pendingCount: number): boolean {
  return pendingCount > 1;
}

export function buildNotificationContent(
  daysRemaining: number,
  pendingThresholds: readonly number[],
): { title: string; body: string } {
  if (pendingThresholds.length === 0) {
    return { title: "", body: "" };
  }
  if (pendingThresholds.length > 1) {
    const labels = pendingThresholds.join(", ");
    return {
      title: "Apple client secret expiring",
      body: `About ${daysRemaining} day(s) left. Catching up on reminders for thresholds: ${labels} days.`,
    };
  }
  const t = pendingThresholds[0];
  return {
    title: "Apple client secret expiring",
    body: `About ${daysRemaining} day(s) left (${t}-day reminder).`,
  };
}

export function mergeFiredThresholds(
  fired: readonly number[],
  newlyFired: readonly number[],
): number[] {
  return [...new Set([...fired, ...newlyFired])].sort((a, b) => b - a);
}

export function loadExpiryNotificationState(): ExpiryNotificationState | null {
  try {
    const raw = localStorage.getItem(EXPIRY_NOTIFICATION_STATE_KEY);
    if (!raw) return null;
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

export function saveExpiryNotificationState(state: ExpiryNotificationState): void {
  localStorage.setItem(EXPIRY_NOTIFICATION_STATE_KEY, JSON.stringify(state));
}

export function clearExpiryNotificationState(): void {
  localStorage.removeItem(EXPIRY_NOTIFICATION_STATE_KEY);
}
