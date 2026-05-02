import { describe, it, expect } from "vitest";
import { decodeAppleClientSecretPayload } from "@/lib/appleJwtDecode";

describe("decodeAppleClientSecretPayload", () => {
  it("decodes minimal valid JWT-shaped string", () => {
    const header = btoa(JSON.stringify({ alg: "ES256", kid: "K", typ: "JWT" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const payload = btoa(
      JSON.stringify({
        iss: "TEAM",
        iat: 100,
        exp: 200,
        aud: "https://appleid.apple.com",
        sub: "com.example.app",
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const jwt = `${header}.${payload}.sig`;
    const r = decodeAppleClientSecretPayload(jwt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toEqual({
      iss: "TEAM",
      iat: 100,
      exp: 200,
      aud: "https://appleid.apple.com",
      sub: "com.example.app",
    });
    expect(r.header.kid).toBe("K");
  });

  it("rejects non-JWT", () => {
    const r = decodeAppleClientSecretPayload("nope");
    expect(r.ok).toBe(false);
  });
});
