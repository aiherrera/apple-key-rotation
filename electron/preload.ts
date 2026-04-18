import { contextBridge, ipcRenderer } from "electron";

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
});
