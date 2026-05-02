import { describe, it, expect } from "vitest";
import { parseCommaSeparatedTags } from "@/components/ProfileEditorDialog";

describe("parseCommaSeparatedTags", () => {
  it("splits on commas only; trims segments; commas never kept in tokens", () => {
    expect(parseCommaSeparatedTags("staging, ios")).toEqual(["staging", "ios"]);
    expect(parseCommaSeparatedTags("staging,")).toEqual(["staging"]);
    expect(parseCommaSeparatedTags(",a,b,")).toEqual(["a", "b"]);
  });

  it("keeps internal spaces when there is no comma", () => {
    expect(parseCommaSeparatedTags("a b  c")).toEqual(["a b  c"]);
  });

  it("trims and drops empties between commas", () => {
    expect(parseCommaSeparatedTags("  x , , y  ")).toEqual(["x", "y"]);
    expect(parseCommaSeparatedTags("foo, bar baz")).toEqual(["foo", "bar baz"]);
  });
});
