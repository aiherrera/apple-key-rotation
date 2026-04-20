import { describe, expect, it, vi } from "vitest";
import {
  appendInAppNotification,
  markAllNotificationsRead,
  markNotificationRead,
  parseStoredNotifications,
  MAX_IN_APP_NOTIFICATIONS,
} from "./inAppNotifications";

describe("parseStoredNotifications", () => {
  it("returns empty array for null or invalid JSON", () => {
    expect(parseStoredNotifications(null)).toEqual([]);
    expect(parseStoredNotifications("")).toEqual([]);
    expect(parseStoredNotifications("{}")).toEqual([]);
  });

  it("parses valid items and skips invalid entries", () => {
    const raw = JSON.stringify([
      {
        id: "a",
        kind: "rotation_success",
        title: "T",
        body: "B",
        createdAt: "2026-01-01T00:00:00.000Z",
        read: false,
      },
      { bad: true },
    ]);
    expect(parseStoredNotifications(raw)).toHaveLength(1);
    expect(parseStoredNotifications(raw)[0]?.id).toBe("a");
  });
});

describe("appendInAppNotification", () => {
  it("prepends and caps length", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-1" });
    const first = appendInAppNotification([], {
      kind: "rotation_failed",
      title: "x",
      body: "y",
    });
    expect(first).toHaveLength(1);
    expect(first[0]?.id).toBe("uuid-1");

    vi.stubGlobal("crypto", { randomUUID: () => "uuid-2" });
    const many = Array.from({ length: MAX_IN_APP_NOTIFICATIONS + 5 }, (_, i) => ({
      id: `id-${i}`,
      kind: "expiry_reminder" as const,
      title: "t",
      body: "b",
      createdAt: new Date().toISOString(),
      read: true,
    }));
    const next = appendInAppNotification(many, {
      kind: "rotation_success",
      title: "n",
      body: "m",
    });
    expect(next).toHaveLength(MAX_IN_APP_NOTIFICATIONS);
    expect(next[0]?.title).toBe("n");
  });
});

describe("markNotificationRead", () => {
  it("marks one id", () => {
    const items = [
      {
        id: "1",
        kind: "expiry_reminder" as const,
        title: "a",
        body: "b",
        createdAt: "",
        read: false,
      },
      {
        id: "2",
        kind: "expiry_reminder" as const,
        title: "c",
        body: "d",
        createdAt: "",
        read: false,
      },
    ];
    const out = markNotificationRead(items, "1");
    expect(out[0]?.read).toBe(true);
    expect(out[1]?.read).toBe(false);
  });
});

describe("markAllNotificationsRead", () => {
  it("sets read on all", () => {
    const items = [
      {
        id: "1",
        kind: "expiry_reminder" as const,
        title: "a",
        body: "b",
        createdAt: "",
        read: false,
      },
    ];
    expect(markAllNotificationsRead(items)[0]?.read).toBe(true);
  });
});
