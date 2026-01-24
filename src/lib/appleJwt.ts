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

// Generate Apple client secret JWT entirely client-side
export async function generateAppleClientSecret(
  config: AppleConfig
): Promise<GenerateResult> {
  const { keyId, teamId, servicesId, privateKeyPem } = config;

  // Validate inputs
  if (!keyId || !teamId || !servicesId) {
    throw new Error("Missing required Apple OAuth configuration (Key ID, Team ID, or Services ID)");
  }

  if (!privateKeyPem || !privateKeyPem.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Invalid private key format. Please upload a valid .p8 file.");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 15777000; // ~6 months in seconds (182.5 days)
  const exp = now + expiresIn;
  const expiresAt = new Date(exp * 1000);

  // JWT Header
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  // JWT Payload
  const payload = {
    iss: teamId,
    iat: now,
    exp: exp,
    aud: "https://appleid.apple.com",
    sub: servicesId,
  };

  // Encode header and payload
  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const keyBuffer = pemToBytes(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(signingInput)
  );

  // Convert signature to Uint8Array and base64url encode
  const signature = new Uint8Array(signatureBuffer);
  const signatureB64 = base64UrlEncode(signature);

  return {
    secret: `${signingInput}.${signatureB64}`,
    expiresAt,
  };
}
