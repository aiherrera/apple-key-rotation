import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  clipboard,
  shell,
} from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildSnapshot,
  closeSqlite,
  exportDatabaseCopy,
  getDbPath,
  importDatabaseReplace,
  importSnapshotReplace,
  isDatabaseEmpty,
  kvDelete,
  kvGetAll,
  kvSet,
  migrateLegacyPayload,
  openSqlite,
  parseSnapshotJson,
  rotationInsert,
  rotationsClear,
  rotationsCount,
  rotationsList,
  savedSecretsCount,
  savedSecretsList,
  wipeAllUserData,
  type RotationRow,
} from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Must stay `.cjs` when package.json has `"type": "module"` so the preload is loaded as CJS. */
const PRELOAD_FILENAME = "preload.cjs";

/** Must match `build.productName` in package.json and window/document titles. */
const APP_DISPLAY_NAME = "Apple Key Rotation";

process.on("message", (msg) => {
  if (msg === "electron-vite&type=hot-reload") {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.reload();
    }
  }
});

const WINDOW_STATE_FILE = "window-state.json";

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

function windowStatePath(): string {
  return path.join(app.getPath("userData"), WINDOW_STATE_FILE);
}

function loadWindowState(): WindowState | null {
  try {
    const raw = fs.readFileSync(windowStatePath(), "utf-8");
    return JSON.parse(raw) as WindowState;
  } catch {
    return null;
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized(),
    };
    fs.mkdirSync(path.dirname(windowStatePath()), { recursive: true });
    fs.writeFileSync(windowStatePath(), JSON.stringify(state), "utf-8");
  } catch {
    // ignore persist errors
  }
}

let mainWindow: BrowserWindow | null = null;

function sendMenuAction(action: string): void {
  const target =
    BrowserWindow.getFocusedWindow() ??
    mainWindow ??
    BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  if (!target || target.isDestroyed()) return;
  target.webContents.send("app:menu-action", action);
}

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

/** Primary Help menu link; override with HELP_URL in the environment when packaging. */
const HELP_MENU_URL =
  process.env.HELP_URL ?? "https://developer.apple.com/sign-in-with-apple/";

function setMacAboutPanel(): void {
  if (process.platform !== "darwin") return;
  app.setAboutPanelOptions({
    applicationName: APP_DISPLAY_NAME,
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: `Copyright © ${new Date().getFullYear()} aiherrera`,
    credits:
      "Generate Sign in with Apple client secrets locally. Your .p8 key is never sent to a server.",
  });
}

function createMenu(): void {
  const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Open signing key (.p8)…",
      accelerator: "CmdOrControl+O",
      click: () => {
        sendMenuAction("open-p8");
      },
    },
    { role: "close" },
    { type: "separator" },
  ];
  if (process.platform !== "darwin") {
    fileSubmenu.push({ role: "quit" });
  }

  const viewSubmenu: Electron.MenuItemConstructorOptions[] = [];
  if (isDev) {
    viewSubmenu.push(
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
    );
  }
  viewSubmenu.push(
    { role: "togglefullscreen" },
    { type: "separator" },
    {
      label: "Open secret generator",
      accelerator: "CmdOrControl+1",
      click: () => {
        sendMenuAction("navigate-home");
      },
    },
    {
      label: "Command palette…",
      accelerator: "CmdOrControl+K",
      click: () => {
        sendMenuAction("command-palette");
      },
    },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
  );

  const template: Electron.MenuItemConstructorOptions[] = [];

  if (process.platform === "darwin") {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        ...(app.isPackaged
          ? ([
              {
                label: "Check for Updates…",
                click: () => {
                  void autoUpdater.checkForUpdates();
                },
              },
            ] satisfies Electron.MenuItemConstructorOptions[])
          : []),
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "CmdOrControl+,",
          click: () => {
            sendMenuAction("focus-settings");
          },
        },
        { type: "separator" },
        {
          label: "What’s new",
          click: () => {
            sendMenuAction("focus-changelog");
          },
        },
        {
          label: "About this app",
          click: () => {
            sendMenuAction("focus-about");
          },
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push(
    {
      label: "File",
      submenu: fileSubmenu,
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
        ...(process.platform === "darwin"
          ? ([
              { type: "separator" as const },
              {
                label: "Speech",
                submenu: [
                  { role: "startSpeaking" },
                  { role: "stopSpeaking" },
                ],
              },
              { type: "separator" as const },
            ] satisfies Electron.MenuItemConstructorOptions[])
          : []),
        {
          label: "Copy latest client secret",
          accelerator: "CmdOrControl+Shift+C",
          click: () => {
            sendMenuAction("copy-secret");
          },
        },
        ...(process.platform !== "darwin"
          ? ([
              { type: "separator" as const },
              {
                label: "Settings…",
                accelerator: "CmdOrControl+,",
                click: () => {
                  sendMenuAction("focus-settings");
                },
              },
            ] satisfies Electron.MenuItemConstructorOptions[])
          : []),
      ],
    },
    {
      label: "View",
      submenu: viewSubmenu,
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(process.platform === "darwin"
          ? ([{ type: "separator" }, { role: "front" }] as const)
          : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        ...(app.isPackaged && process.platform !== "darwin"
          ? ([
              {
                label: "Check for Updates…",
                click: () => {
                  void autoUpdater.checkForUpdates();
                },
              },
              { type: "separator" as const },
            ] satisfies Electron.MenuItemConstructorOptions[])
          : []),
        {
          label: "What’s new",
          click: () => {
            sendMenuAction("focus-changelog");
          },
        },
        {
          label: "About this app",
          click: () => {
            sendMenuAction("focus-about");
          },
        },
        { type: "separator" },
        {
          label: "Client secrets & Sign in with Apple (web)…",
          accelerator: "CmdOrControl+?",
          click: () => {
            void shell.openExternal(HELP_MENU_URL);
          },
        },
        { type: "separator" },
        {
          label: "Apple Developer Account",
          click: () => {
            void shell.openExternal("https://developer.apple.com/account/");
          },
        },
        {
          label: "Sign in with Apple",
          click: () => {
            void shell.openExternal(
              "https://developer.apple.com/sign-in-with-apple/",
            );
          },
        },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const saved = loadWindowState();
  const defaultW = 1100;
  const defaultH = 800;

  const preloadAbs = path.join(__dirname, PRELOAD_FILENAME);
  if (isDev && !fs.existsSync(preloadAbs)) {
    console.error("[main] Preload missing (run electron:dev from repo root):", preloadAbs);
  }

  const win = new BrowserWindow({
    width: saved?.width ?? defaultW,
    height: saved?.height ?? defaultH,
    x: saved?.x,
    y: saved?.y,
    minWidth: 640,
    minHeight: 480,
    title: APP_DISPLAY_NAME,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadAbs,
    },
  });

  mainWindow = win;

  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[main] preload-error", preloadPath, error);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const { protocol } = new URL(url);
      if (protocol === "http:" || protocol === "https:") {
        void shell.openExternal(url);
      }
    } catch {
      // ignore malformed URLs
    }
    return { action: "deny" };
  });

  if (saved?.isMaximized) {
    win.maximize();
  }

  win.once("ready-to-show", () => {
    win.show();
  });

  createMenu();

  win.on("close", () => {
    saveWindowState(win);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  ipcMain.handle(
    "p8:open",
    async (): Promise<{
      canceled: boolean;
      content?: string;
      fileName?: string;
    }> => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Apple Auth Key", extensions: ["p8"] }],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, "utf-8");
      const fileName = path.basename(filePath);
      return { canceled: false, content, fileName };
    },
  );

  ipcMain.handle("clipboard:write", (_event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle("sqlite:getAllKv", (): Record<string, string> => {
    return kvGetAll();
  });

  ipcMain.handle("sqlite:setKv", (_e, key: string, value: string) => {
    kvSet(key, value);
  });

  ipcMain.handle("sqlite:removeKv", (_e, key: string) => {
    kvDelete(key);
  });

  ipcMain.handle(
    "sqlite:listRotations",
    (
      _e,
      opts: { profileId?: string; limit: number; offset: number },
    ): RotationRow[] => {
      return rotationsList(opts);
    },
  );

  ipcMain.handle(
    "sqlite:listSavedSecrets",
    (
      _e,
      opts: { profileId?: string; limit: number; offset: number },
    ): RotationRow[] => {
      return savedSecretsList(opts);
    },
  );

  ipcMain.handle("sqlite:countRotations", (_e, profileId?: string): number => {
    return rotationsCount(profileId);
  });

  ipcMain.handle("sqlite:countSavedSecrets", (_e, profileId?: string): number => {
    return savedSecretsCount(profileId);
  });

  ipcMain.handle("sqlite:addRotation", (_e, row: RotationRow) => {
    rotationInsert(row);
  });

  ipcMain.handle("sqlite:clearRotations", () => {
    rotationsClear();
  });

  ipcMain.handle("sqlite:clearAllUserData", () => {
    wipeAllUserData();
  });

  ipcMain.handle("sqlite:isEmpty", (): boolean => {
    return isDatabaseEmpty();
  });

  ipcMain.handle(
    "sqlite:migrateLegacy",
    (_e, payload: { kv: Record<string, string>; rotations: RotationRow[] }) => {
      migrateLegacyPayload(payload);
    },
  );

  ipcMain.handle("sqlite:getDbPath", (): string => {
    return getDbPath(app.getPath("userData"));
  });

  ipcMain.handle("sqlite:exportDatabase", async (): Promise<{ ok: boolean; path?: string }> => {
    const day = new Date().toISOString().split("T")[0];
    const result = await dialog.showSaveDialog({
      title: "Export database backup",
      defaultPath: `apple-key-rotation-backup-${day}.sqlite`,
      filters: [{ name: "SQLite database", extensions: ["sqlite", "db"] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false };
    }
    exportDatabaseCopy(app.getPath("userData"), result.filePath);
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle("sqlite:importDatabase", async (): Promise<{ ok: boolean }> => {
    const result = await dialog.showOpenDialog({
      title: "Restore database backup",
      properties: ["openFile"],
      filters: [{ name: "SQLite database", extensions: ["sqlite", "db"] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false };
    }
    importDatabaseReplace(app.getPath("userData"), result.filePaths[0]);
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    win?.reload();
    return { ok: true };
  });

  ipcMain.handle(
    "sqlite:exportSnapshotJson",
    async (): Promise<{ ok: boolean; path?: string; error?: string }> => {
      const day = new Date().toISOString().split("T")[0];
      const result = await dialog.showSaveDialog({
        title: "Export JSON snapshot",
        defaultPath: `apple-key-rotation-snapshot-${day}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) {
        return { ok: false };
      }
      try {
        const snap = buildSnapshot();
        fs.writeFileSync(result.filePath, JSON.stringify(snap, null, 2), "utf-8");
        return { ok: true, path: result.filePath };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  ipcMain.handle(
    "sqlite:importSnapshotJson",
    async (
      _e,
      mode: "replace" | "merge",
    ): Promise<{ ok: boolean; error?: string }> => {
      const result = await dialog.showOpenDialog({
        title:
          mode === "replace"
            ? "Restore JSON snapshot (replace all data)"
            : "Import JSON snapshot (merge)",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false };
      }
      try {
        const text = fs.readFileSync(result.filePaths[0], "utf-8");
        const payload = parseSnapshotJson(text);
        if (mode === "replace") {
          importSnapshotReplace(payload);
        } else {
          migrateLegacyPayload(payload);
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    openSqlite(app.getPath("userData"));
    app.setName(APP_DISPLAY_NAME);
    setMacAboutPanel();
    createWindow();

    if (app.isPackaged && !isDev) {
      autoUpdater.on("error", (err) => {
        console.error("[updater]", err);
      });
      void autoUpdater.checkForUpdatesAndNotify();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  closeSqlite();
});
