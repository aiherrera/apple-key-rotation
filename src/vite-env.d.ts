/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELECTRON?: string;
  readonly VITE_APP_VERSION: string;
}

interface ElectronAPI {
  openP8File: () => Promise<{
    canceled: boolean;
    content?: string;
    fileName?: string;
  }>;
  writeClipboard: (text: string) => Promise<void>;
  platform: string;
  onMenuAction: (handler: (action: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
