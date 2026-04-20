import { contextBridge, ipcRenderer } from "electron";

/** Aligned with `src/lib/persistedRotation.ts` (kept local for preload bundle). */
type PersistedRotationRow = {
  id: string;
  profile_id: string;
  rotated_at: string;
  expires_at: string;
  status: string;
  error_message: string | null;
  triggered_by: string;
  jwt: string | null;
  key_id: string | null;
  team_id: string | null;
  services_id: string | null;
};

contextBridge.exposeInMainWorld("electronAPI", {
  openP8File: (): Promise<{
    canceled: boolean;
    content?: string;
    fileName?: string;
  }> => ipcRenderer.invoke("p8:open"),

  writeClipboard: (text: string): Promise<void> => ipcRenderer.invoke("clipboard:write", text),

  platform: process.platform,

  onMenuAction: (handler: (action: string) => void): (() => void) => {
    const listener = (_event: unknown, action: string): void => {
      handler(action);
    };
    ipcRenderer.on("app:menu-action", listener);
    return () => {
      ipcRenderer.removeListener("app:menu-action", listener);
    };
  },

  sqlite: {
    getAllKv: (): Promise<Record<string, string>> => ipcRenderer.invoke("sqlite:getAllKv"),
    setKv: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke("sqlite:setKv", key, value),
    removeKv: (key: string): Promise<void> => ipcRenderer.invoke("sqlite:removeKv", key),
    listRotations: (opts: {
      profileId?: string;
      limit: number;
      offset: number;
    }): Promise<PersistedRotationRow[]> => ipcRenderer.invoke("sqlite:listRotations", opts),
    listSavedSecrets: (opts: {
      profileId?: string;
      limit: number;
      offset: number;
    }): Promise<PersistedRotationRow[]> => ipcRenderer.invoke("sqlite:listSavedSecrets", opts),
    countRotations: (profileId?: string): Promise<number> =>
      ipcRenderer.invoke("sqlite:countRotations", profileId),
    countSavedSecrets: (profileId?: string): Promise<number> =>
      ipcRenderer.invoke("sqlite:countSavedSecrets", profileId),
    addRotation: (row: PersistedRotationRow): Promise<void> =>
      ipcRenderer.invoke("sqlite:addRotation", row),
    clearRotations: (): Promise<void> => ipcRenderer.invoke("sqlite:clearRotations"),
    clearAllUserData: (): Promise<void> => ipcRenderer.invoke("sqlite:clearAllUserData"),
    isEmpty: (): Promise<boolean> => ipcRenderer.invoke("sqlite:isEmpty"),
    migrateLegacy: (payload: {
      kv: Record<string, string>;
      rotations: PersistedRotationRow[];
    }): Promise<void> => ipcRenderer.invoke("sqlite:migrateLegacy", payload),
    getDbPath: (): Promise<string> => ipcRenderer.invoke("sqlite:getDbPath"),
    exportDatabase: (): Promise<{ ok: boolean; path?: string }> =>
      ipcRenderer.invoke("sqlite:exportDatabase"),
    importDatabase: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("sqlite:importDatabase"),
    exportSnapshotJson: (): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke("sqlite:exportSnapshotJson"),
    importSnapshotJson: (
      mode: "replace" | "merge",
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("sqlite:importSnapshotJson", mode),
  },
});
