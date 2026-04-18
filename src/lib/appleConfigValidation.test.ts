import { describe, it, expect } from "vitest";
import { validateAppleIds } from "./appleConfigValidation";

describe("validateAppleIds", () => {
  it("accepts valid 10-char IDs and bundle-style services id", () => {
    const r = validateAppleIds("ABCDEFGHIJ", "KLMNOPQRST", "com.example.app");
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects wrong lengths", () => {
    const r = validateAppleIds("SHORT", "KLMNOPQRST", "com.example.app");
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects services id without dots", () => {
    const r = validateAppleIds("ABCDEFGHIJ", "KLMNOPQRST", "invalid");
    expect(r.ok).toBe(false);
  });
});
