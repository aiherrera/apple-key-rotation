/** Read-only decode of Apple client_secret JWT middle segment (never validates signature). */

export type AppleClientSecretPayload = {
  iss?: string;
  iat?: number;
  exp?: number;
  aud?: string;
  sub?: string;
};

function base64UrlToString(segment: string): string {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function decodeAppleClientSecretPayload(jwt: string): {
  ok: true;
  payload: AppleClientSecretPayload;
  header: Record<string, unknown>;
} | {
  ok: false;
  error: string;
} {
  const trimmed = jwt.trim();
  const parts = trimmed.split(".");
  if (parts.length < 2) {
    return { ok: false, error: "Not a JWT (expected header.payload…)" };
  }
  let headerJson: string;
  let payloadJson: string;
  try {
    headerJson = base64UrlToString(parts[0]);
    payloadJson = base64UrlToString(parts[1]);
  } catch {
    return { ok: false, error: "Invalid base64url segment" };
  }
  let header: Record<string, unknown>;
  let payloadRaw: unknown;
  try {
    header = JSON.parse(headerJson) as Record<string, unknown>;
    payloadRaw = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: "Invalid JSON in token" };
  }
  const p =
    payloadRaw && typeof payloadRaw === "object"
      ? (payloadRaw as Record<string, unknown>)
      : {};
  const payload: AppleClientSecretPayload = {
    iss: typeof p.iss === "string" ? p.iss : undefined,
    iat: typeof p.iat === "number" ? p.iat : undefined,
    exp: typeof p.exp === "number" ? p.exp : undefined,
    aud: typeof p.aud === "string" ? p.aud : undefined,
    sub: typeof p.sub === "string" ? p.sub : undefined,
  };
  return { ok: true, header, payload };
}
