import { describe, it, expect, vi } from "vitest";
import {
  generateAppleClientSecret,
  generateAppleClientSecretWithSubtle,
} from "./appleJwt";

async function p256Pkcs8Pem(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );
  const raw = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const bytes = new Uint8Array(raw);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
}

describe("generateAppleClientSecret", () => {
  it("returns a three-part JWT and expiry after now", async () => {
    const pem = await p256Pkcs8Pem();
    const result = await generateAppleClientSecret({
      keyId: "ABCDEFGHIJ",
      teamId: "KLMNOPQRST",
      servicesId: "com.example.app",
      privateKeyPem: pem,
    });
    expect(result.secret.split(".")).toHaveLength(3);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("maps invalid key material to a readable error", async () => {
    await expect(
      generateAppleClientSecret({
        keyId: "ABCDEFGHIJ",
        teamId: "KLMNOPQRST",
        servicesId: "com.example.app",
        privateKeyPem: "-----BEGIN PRIVATE KEY-----\nZm9v\n-----END PRIVATE KEY-----",
      }),
    ).rejects.toThrow(/private key|read|valid/i);
  });

  it("generateAppleClientSecretWithSubtle works with injected subtle", async () => {
    vi.useFakeTimers({ now: new Date("2026-06-15T12:00:00Z") });
    try {
      const pem = await p256Pkcs8Pem();
      const result = await generateAppleClientSecretWithSubtle(
        {
          keyId: "ABCDEFGHIJ",
          teamId: "KLMNOPQRST",
          servicesId: "com.example.app",
          privateKeyPem: pem,
        },
        crypto.subtle,
      );
      expect(result.secret.split(".")).toHaveLength(3);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    } finally {
      vi.useRealTimers();
    }
  });
});
