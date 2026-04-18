import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  clipboard,
  shell,
} from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function createMenu(win: BrowserWindow): void {
  const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Open .p8 key…",
      accelerator: "CmdOrControl+O",
      click: () => {
        win.webContents.send("app:menu-action", "open-p8");
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
      label: "Go to Rotation",
      accelerator: "CmdOrControl+1",
      click: () => {
        win.webContents.send("app:menu-action", "navigate-home");
      },
    },
    {
      label: "Command Palette…",
      accelerator: "CmdOrControl+K",
      click: () => {
        win.webContents.send("app:menu-action", "command-palette");
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
          label: "Preferences…",
          accelerator: "CmdOrControl+,",
          click: () => {
            win.webContents.send("app:menu-action", "focus-settings");
          },
        },
        { type: "separator" },
        {
          label: "Changelog",
          click: () => {
            win.webContents.send("app:menu-action", "focus-changelog");
          },
        },
        {
          label: "Author & credits",
          click: () => {
            win.webContents.send("app:menu-action", "focus-about");
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
          label: "Copy generated secret",
          accelerator: "CmdOrControl+Shift+C",
          click: () => {
            win.webContents.send("app:menu-action", "copy-secret");
          },
        },
        ...(process.platform !== "darwin"
          ? ([
              { type: "separator" as const },
              {
                label: "Preferences…",
                accelerator: "CmdOrControl+,",
                click: () => {
                  win.webContents.send("app:menu-action", "focus-settings");
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
          label: "Changelog",
          click: () => {
            win.webContents.send("app:menu-action", "focus-changelog");
          },
        },
        {
          label: "Author & credits",
          click: () => {
            win.webContents.send("app:menu-action", "focus-about");
          },
        },
        { type: "separator" },
        {
          label: "Apple Key Rotation Help",
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
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow = win;

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

  createMenu(win);

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

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
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
