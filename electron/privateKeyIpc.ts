import { safeStorage, dialog } from "electron";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  privateKeyDelete,
  privateKeyDeleteAll,
  privateKeyGetEncPem,
  privateKeyHas,
  privateKeyUpsert,
} from "./db";
import { signClientSecretInMain } from "./appleSignMain";

const nodeRequire = createRequire(import.meta.url);

const TOUCH_REVEAL_REASON =
  "Reveal your saved Sign in with Apple private key (.p8) in Apple Key Rotation.";
const TOUCH_EXPORT_REASON =
  "Export your saved Sign in with Apple private key (.p8) from Apple Key Rotation.";

function assertP8Pem(pem: string): void {
  if (!pem || !pem.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Invalid .p8 file format");
  }
}

function encryptPemForStore(pem: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Cannot save keys: encryption is not available on this system.");
  }
  return safeStorage.encryptString(pem);
}

function decryptPemFromStore(buf: Buffer): string {
  return safeStorage.decryptString(buf);
}

async function requireLocalAuthentication(reason: string): Promise<void> {
  if (process.platform !== "darwin") {
    return;
  }
  const { promptTouchID } = nodeRequire("node-mac-auth") as {
    promptTouchID: (options: { reason: string; reuseDuration?: number }) => Promise<void>;
  };
  await promptTouchID({ reason });
}

export function privateKeyIsEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function privateKeyIpcHas(profileId: string): boolean {
  return privateKeyHas(profileId);
}

export function privateKeyIpcSavePem(profileId: string, pem: string): void {
  assertP8Pem(pem);
  privateKeyUpsert(profileId, encryptPemForStore(pem));
}

export function privateKeyIpcForget(profileId: string): void {
  privateKeyDelete(profileId);
}

export function privateKeyIpcForgetAll(): void {
  privateKeyDeleteAll();
}

export async function privateKeyIpcImportFromDialog(
  profileId: string,
): Promise<{ ok: boolean; fileName?: string; error?: string }> {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Apple Auth Key", extensions: ["p8"] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false };
  }
  const filePath = result.filePaths[0];
  try {
    const pem = fs.readFileSync(filePath, "utf-8");
    assertP8Pem(pem);
    privateKeyUpsert(profileId, encryptPemForStore(pem));
    return { ok: true, fileName: path.basename(filePath) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function privateKeyIpcRevealPem(profileId: string): Promise<{ ok: boolean; pem?: string; error?: string }> {
  try {
    await requireLocalAuthentication(TOUCH_REVEAL_REASON);
    const enc = privateKeyGetEncPem(profileId);
    if (!enc) {
      return { ok: false, error: "No saved key for this profile." };
    }
    return { ok: true, pem: decryptPemFromStore(enc) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/canceled|cancelled|user canceled/i.test(msg)) {
      return { ok: false, error: "Authentication was canceled." };
    }
    return { ok: false, error: msg || "Authentication failed." };
  }
}

export async function privateKeyIpcExportPemToFile(
  profileId: string,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    await requireLocalAuthentication(TOUCH_EXPORT_REASON);
    const enc = privateKeyGetEncPem(profileId);
    if (!enc) {
      return { ok: false, error: "No saved key for this profile." };
    }
    const pem = decryptPemFromStore(enc);
    const day = new Date().toISOString().split("T")[0];
    const result = await dialog.showSaveDialog({
      title: "Export .p8",
      defaultPath: `AuthKey_exported-${day}.p8`,
      filters: [{ name: "Apple Auth Key", extensions: ["p8"] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false };
    }
    fs.writeFileSync(result.filePath, pem, "utf-8");
    return { ok: true, path: result.filePath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/canceled|cancelled|user canceled/i.test(msg)) {
      return { ok: false, error: "Authentication was canceled." };
    }
    return { ok: false, error: msg || "Export failed." };
  }
}

export async function appleSignIpcSignClientSecret(payload: {
  profileId: string;
  keyId: string;
  teamId: string;
  servicesId: string;
}): Promise<{ ok: boolean; secret?: string; expiresAtIso?: string; error?: string }> {
  try {
    const enc = privateKeyGetEncPem(payload.profileId);
    if (!enc) {
      return { ok: false, error: "No saved key for this profile." };
    }
    const pem = decryptPemFromStore(enc);
    const { secret, expiresAtIso } = await signClientSecretInMain({
      keyId: payload.keyId.trim(),
      teamId: payload.teamId.trim(),
      servicesId: payload.servicesId.trim(),
      privateKeyPem: pem,
    });
    return { ok: true, secret, expiresAtIso };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
