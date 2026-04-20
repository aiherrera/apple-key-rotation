/** In-app notification feed (persisted in localStorage). */

export type InAppNotificationKind = "expiry_reminder" | "rotation_success" | "rotation_failed";

export type InAppNotification = {
  id: string;
  kind: InAppNotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export const IN_APP_NOTIFICATIONS_STORAGE_KEY = "in_app_notifications_v1";
export const MAX_IN_APP_NOTIFICATIONS = 200;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isKind(v: unknown): v is InAppNotificationKind {
  return v === "expiry_reminder" || v === "rotation_success" || v === "rotation_failed";
}

export function parseStoredNotifications(raw: string | null): InAppNotification[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: InAppNotification[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      const {
        id,
        kind,
        title,
        body,
        createdAt,
        read,
      } = item as Record<string, unknown>;
      if (
        typeof id === "string" &&
        isKind(kind) &&
        typeof title === "string" &&
        typeof body === "string" &&
        typeof createdAt === "string" &&
        typeof read === "boolean"
      ) {
        out.push({ id, kind, title, body, createdAt, read });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function appendInAppNotification(
  current: readonly InAppNotification[],
  input: {
    kind: InAppNotificationKind;
    title: string;
    body: string;
    read?: boolean;
  },
): InAppNotification[] {
  const n: InAppNotification = {
    id: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    createdAt: new Date().toISOString(),
    read: input.read ?? false,
  };
  return [n, ...current].slice(0, MAX_IN_APP_NOTIFICATIONS);
}

export function markNotificationRead(
  items: readonly InAppNotification[],
  id: string,
): InAppNotification[] {
  return items.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markAllNotificationsRead(items: readonly InAppNotification[]): InAppNotification[] {
  return items.map((n) => (n.read ? n : { ...n, read: true }));
}
