/**
 * Holds the most recently generated client secret so the macOS menu can copy it
 * from any route (the generator page may be unmounted on Settings).
 * Cleared when the user clears the secret on the generator screen.
 */
let lastClientSecret: string | null = null;

export function setElectronLastClientSecret(secret: string | null): void {
  lastClientSecret = secret;
}

export function getElectronLastClientSecret(): string | null {
  return lastClientSecret;
}
