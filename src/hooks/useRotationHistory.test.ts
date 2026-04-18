import { describe, it, expect } from "vitest";
import { takeLatestRotations, type RotationRecord } from "./useRotationHistory";

describe("takeLatestRotations", () => {
  it("sorts by rotated_at descending and caps length", () => {
    const records: RotationRecord[] = [
      {
        id: "a",
        rotated_at: "2020-01-01T00:00:00.000Z",
        expires_at: "2020-07-01T00:00:00.000Z",
        status: "success",
        error_message: null,
        triggered_by: "manual",
      },
      {
        id: "b",
        rotated_at: "2021-01-01T00:00:00.000Z",
        expires_at: "2021-07-01T00:00:00.000Z",
        status: "success",
        error_message: null,
        triggered_by: "manual",
      },
      {
        id: "c",
        rotated_at: "2019-01-01T00:00:00.000Z",
        expires_at: "2019-07-01T00:00:00.000Z",
        status: "failed",
        error_message: "x",
        triggered_by: "manual",
      },
    ];
    const out = takeLatestRotations(records, 2);
    expect(out.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
