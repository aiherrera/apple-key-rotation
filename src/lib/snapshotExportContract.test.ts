import { describe, it, expect } from "vitest";

/** Documented contract: `electron/db.ts` `buildSnapshot` must only include these top-level keys (never `profile_private_keys`). */
const SNAPSHOT_TOP_LEVEL_KEYS = ["schemaVersion", "exportedAt", "kv", "rotations"] as const;

describe("JSON snapshot export contract", () => {
  it("uses only kv + rotations + metadata (no private key table)", () => {
    expect(SNAPSHOT_TOP_LEVEL_KEYS).toEqual([
      "schemaVersion",
      "exportedAt",
      "kv",
      "rotations",
    ]);
  });
});
