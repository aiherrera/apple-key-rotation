/** Apple Developer Team ID and Key ID are 10-character strings (alphanumeric). */
const ID_LEN = 10;
const ID_RE = /^[A-Z0-9]{10}$/i;

/** Services ID (client id) is typically a reverse-DNS bundle id. */
const SERVICES_RE = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/;

export interface AppleIdsValidation {
  ok: boolean;
  errors: string[];
}

export function validateAppleIds(
  keyId: string,
  teamId: string,
  servicesId: string,
): AppleIdsValidation {
  const errors: string[] = [];
  const k = keyId.trim();
  const t = teamId.trim();
  const s = servicesId.trim();

  if (k.length !== ID_LEN || !ID_RE.test(k)) {
    errors.push("Key ID must be exactly 10 letters or numbers (from Apple Developer).");
  }
  if (t.length !== ID_LEN || !ID_RE.test(t)) {
    errors.push("Team ID must be exactly 10 letters or numbers (from Apple Developer).");
  }
  if (!SERVICES_RE.test(s)) {
    errors.push(
      "Services ID should look like a bundle identifier (e.g. com.example.app).",
    );
  }

  return { ok: errors.length === 0, errors };
}
