/// <reference types="vite/client" />

import type { PersistedRotationRow } from "@/lib/persistedRotation";

interface ImportMetaEnv {
  readonly VITE_ELECTRON?: string;
  readonly VITE_APP_VERSION: string;
}

type SqliteApi = {
  getAllKv: () => Promise<Record<string, string>>;
  setKv: (key: string, value: string) => Promise<void>;
  removeKv: (key: string) => Promise<void>;
  listRotations: (opts: {
    profileId?: string;
    limit: number;
    offset: number;
  }) => Promise<PersistedRotationRow[]>;
  listSavedSecrets: (opts: {
    profileId?: string;
    limit: number;
    offset: number;
  }) => Promise<PersistedRotationRow[]>;
  countRotations: (profileId?: string) => Promise<number>;
  countSavedSecrets: (profileId?: string) => Promise<number>;
  addRotation: (row: PersistedRotationRow) => Promise<void>;
  updateRotationUserNote: (id: string, user_note: string | null) => Promise<void>;
  clearRotations: () => Promise<void>;
  clearAllUserData: () => Promise<void>;
  isEmpty: () => Promise<boolean>;
  migrateLegacy: (payload: {
    kv: Record<string, string>;
    rotations: PersistedRotationRow[];
  }) => Promise<void>;
  getDbPath: () => Promise<string>;
  exportDatabase: () => Promise<{ ok: boolean; path?: string }>;
  importDatabase: () => Promise<{ ok: boolean }>;
  exportSnapshotJson: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  importSnapshotJson: (
    mode: "replace" | "merge",
  ) => Promise<{ ok: boolean; error?: string }>;
};

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  openP8File: () => Promise<{
    canceled: boolean;
    content?: string;
    fileName?: string;
  }>;
  writeClipboard: (text: string) => Promise<void>;
  platform: string;
  onMenuAction: (handler: (action: string) => void) => () => void;
  sqlite: SqliteApi;
  privateKey: {
    isEncryptionAvailable: () => Promise<boolean>;
    has: (profileId: string) => Promise<boolean>;
    savePem: (profileId: string, pem: string) => Promise<void>;
    forget: (profileId: string) => Promise<void>;
    forgetAll: () => Promise<void>;
    importFromDialog: (
      profileId: string,
    ) => Promise<{ ok: boolean; fileName?: string; error?: string }>;
    revealPem: (profileId: string) => Promise<{ ok: boolean; pem?: string; error?: string }>;
    exportPemToFile: (profileId: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  };
  appleSign: {
    signClientSecret: (payload: {
      profileId: string;
      keyId: string;
      teamId: string;
      servicesId: string;
    }) => Promise<{ ok: boolean; secret?: string; expiresAtIso?: string; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
