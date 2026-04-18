import { z } from "zod";

export const EXPIRY_THRESHOLD_OPTIONS = [15, 10, 7, 3] as const;
export type ExpiryThresholdDay = (typeof EXPIRY_THRESHOLD_OPTIONS)[number];

const thresholdLiteral = z.union([
  z.literal(15),
  z.literal(10),
  z.literal(7),
  z.literal(3),
]);

export const appSettingsSchema = z.object({
  expiryNotificationsEnabled: z.boolean(),
  expiryNotificationThresholds: z.array(thresholdLiteral).min(1),
  startupToastsEnabled: z.boolean(),
  inlineExpiringDays: z.number().int().min(1).max(365),
  notificationPermissionHintDismissed: z.boolean(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings: AppSettings = {
  expiryNotificationsEnabled: true,
  expiryNotificationThresholds: [15, 10, 7, 3],
  startupToastsEnabled: true,
  inlineExpiringDays: 15,
  notificationPermissionHintDismissed: false,
};

export const APP_SETTINGS_STORAGE_KEY = "app_settings_v1";

export function parseAppSettings(raw: unknown): AppSettings {
  const r = appSettingsSchema.safeParse(raw);
  if (!r.success) {
    return { ...defaultAppSettings };
  }
  const sorted = [...new Set(r.data.expiryNotificationThresholds)].sort((a, b) => b - a);
  const valid = sorted.filter((t): t is ExpiryThresholdDay =>
    EXPIRY_THRESHOLD_OPTIONS.includes(t as ExpiryThresholdDay),
  );
  return {
    ...r.data,
    expiryNotificationThresholds: valid.length > 0 ? valid : defaultAppSettings.expiryNotificationThresholds,
  };
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultAppSettings };
    return parseAppSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...defaultAppSettings };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
