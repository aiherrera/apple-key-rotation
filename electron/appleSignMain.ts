import { webcrypto } from "node:crypto";
import { generateAppleClientSecretWithSubtle } from "../src/lib/appleJwt";

export async function signClientSecretInMain(config: {
  keyId: string;
  teamId: string;
  servicesId: string;
  privateKeyPem: string;
}): Promise<{ secret: string; expiresAtIso: string }> {
  const { secret, expiresAt } = await generateAppleClientSecretWithSubtle(config, webcrypto.subtle);
  return { secret, expiresAtIso: expiresAt.toISOString() };
}
