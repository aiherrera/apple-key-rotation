// Base64URL encode (RFC 7515)
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert PEM to raw key bytes
function pemToBytes(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface AppleConfig {
  keyId: string;
  teamId: string;
  servicesId: string;
  privateKeyPem: string;
}

export interface GenerateResult {
  secret: string;
  expiresAt: Date;
}

function mapCryptoError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (
    lower.includes("pkcs") ||
    lower.includes("decode") ||
    (lower.includes("invalid") && lower.includes("key"))
  ) {
    return "Could not read the private key. Confirm the file is a valid Apple .p8 (EC P-256) key from Certificates, Identifiers & Profiles.";
  }
  if (lower.includes("curve") || lower.includes("p-256") || lower.includes("namedcurve")) {
    return "This key is not P-256 (ES256). Apple Sign in with Apple keys must be the EC key type shown when you create a Sign in with Apple key.";
  }
  if (lower.includes("operationerror") || lower.includes("sign")) {
    return "Signing failed. The .p8 may be corrupted or not the key that matches your Key ID.";
  }
  return msg || "Key signing failed.";
}

/**
 * Generate Apple client secret JWT using the given SubtleCrypto implementation
 * (browser `crypto.subtle` or Node `webcrypto.subtle`).
 */
export async function generateAppleClientSecretWithSubtle(
  config: AppleConfig,
  subtle: SubtleCrypto,
): Promise<GenerateResult> {
  const { keyId, teamId, servicesId, privateKeyPem } = config;

  if (!keyId || !teamId || !servicesId) {
    throw new Error(
      "Missing required Apple OAuth configuration (Key ID, Team ID, or Services ID)",
    );
  }

  if (!privateKeyPem || !privateKeyPem.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Invalid private key format. Please upload a valid .p8 file.");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 15777000; // ~6 months in seconds (182.5 days)
  const exp = now + expiresIn;
  const expiresAt = new Date(exp * 1000);

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const payload = {
    iss: teamId,
    iat: now,
    exp: exp,
    aud: "https://appleid.apple.com",
    sub: servicesId,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const keyBuffer = pemToBytes(privateKeyPem);
    const cryptoKey = await subtle.importKey(
      "pkcs8",
      keyBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      encoder.encode(signingInput),
    );

    const signature = new Uint8Array(signatureBuffer);
    const signatureB64 = base64UrlEncode(signature);

    return {
      secret: `${signingInput}.${signatureB64}`,
      expiresAt,
    };
  } catch (e) {
    throw new Error(mapCryptoError(e));
  }
}

/** Generate Apple client secret JWT in the browser (Web Crypto). */
export async function generateAppleClientSecret(config: AppleConfig): Promise<GenerateResult> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto is not available in this environment.");
  }
  return generateAppleClientSecretWithSubtle(config, subtle);
}
