import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildNotificationContent,
  computePendingThresholds,
  EXPIRY_NOTIFICATION_STATE_KEY,
  getCeiledDaysRemaining,
  loadExpiryNotificationState,
  mergeFiredThresholds,
  saveExpiryNotificationState,
  shouldBatchNotify,
} from "./expiryNotifications";

describe("getCeiledDaysRemaining", () => {
  it("returns ceil of fractional days", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const exp = new Date("2026-06-10T06:00:00.000Z");
    const days = getCeiledDaysRemaining(exp.toISOString(), now);
    expect(days).toBe(9);
  });

  it("returns 0 or negative when expired", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const exp = new Date("2026-06-10T12:00:00.000Z");
    expect(getCeiledDaysRemaining(exp.toISOString(), now)).toBeLessThanOrEqual(0);
  });
});

describe("computePendingThresholds", () => {
  const enabled = [15, 10, 7, 3] as const;

  it("returns empty when no threshold applies", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const exp = new Date("2026-03-01T12:00:00.000Z");
    expect(computePendingThresholds(exp.toISOString(), now, enabled, [])).toEqual([]);
  });

  it("returns 15 when 12 days left and nothing fired", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const exp = new Date("2026-01-13T12:00:00.000Z");
    expect(computePendingThresholds(exp.toISOString(), now, enabled, [])).toEqual([15]);
  });

  it("returns multiple when catch-up: 8 days and none fired (10 and 15, not 7 yet)", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const exp = new Date("2026-01-09T12:00:00.000Z");
    expect(computePendingThresholds(exp.toISOString(), now, enabled, [])).toEqual([10, 15]);
  });

  it("skips already fired thresholds", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const exp = new Date("2026-01-09T12:00:00.000Z");
    expect(computePendingThresholds(exp.toISOString(), now, enabled, [15, 10])).toEqual([]);
  });

  it("returns empty when expired", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const exp = new Date("2026-06-10T12:00:00.000Z");
    expect(computePendingThresholds(exp.toISOString(), now, enabled, [])).toEqual([]);
  });
});

describe("shouldBatchNotify", () => {
  it("batches when more than one pending", () => {
    expect(shouldBatchNotify(2)).toBe(true);
    expect(shouldBatchNotify(1)).toBe(false);
  });
});

describe("buildNotificationContent", () => {
  it("returns empty when no pending", () => {
    expect(buildNotificationContent(5, [])).toEqual({ title: "", body: "" });
  });

  it("single threshold message", () => {
    const r = buildNotificationContent(8, [7]);
    expect(r.title).toBe("Apple client secret expiring");
    expect(r.body).toContain("8");
    expect(r.body).toContain("7");
  });

  it("batch message lists thresholds", () => {
    const r = buildNotificationContent(8, [7, 10, 15]);
    expect(r.title).toBe("Apple client secret expiring");
    expect(r.body).toContain("8");
    expect(r.body).toContain("7, 10, 15");
  });
});

describe("mergeFiredThresholds", () => {
  it("dedupes and merges", () => {
    expect(mergeFiredThresholds([15], [10, 15])).toEqual([15, 10]);
  });
});

describe("expiry notification state persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips state", () => {
    const state = { expiresAt: "2026-12-01T00:00:00.000Z", firedThresholds: [15, 10] };
    saveExpiryNotificationState(state);
    expect(localStorage.getItem(EXPIRY_NOTIFICATION_STATE_KEY)).toBeTruthy();
    expect(loadExpiryNotificationState()).toEqual(state);
  });
});
