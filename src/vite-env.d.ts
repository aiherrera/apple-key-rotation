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
  openP8File: () => Promise<{
    canceled: boolean;
    content?: string;
    fileName?: string;
  }>;
  writeClipboard: (text: string) => Promise<void>;
  platform: string;
  onMenuAction: (handler: (action: string) => void) => () => void;
  sqlite: SqliteApi;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
