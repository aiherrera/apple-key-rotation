/**
 * True when built with `ELECTRON=true`, preload is present, the page is served from
 * `file://` (typical packaged app), or the Electron user agent is detected. The latter
 * two catch mismatched renderer builds where `window.electronAPI` is missing.
 */
export function isElectronApp(): boolean {
  if (import.meta.env.VITE_ELECTRON === "true") return true;
  if (typeof window === "undefined") return false;
  if (window.electronAPI) return true;
  if (window.location?.protocol === "file:") return true;
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) {
    return true;
  }
  return false;
}

/** SQLite persistence is available (Electron main + preload). */
export function hasElectronSqlite(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.electronAPI?.sqlite);
}

/**
 * Show Data & privacy backup cards when IPC is ready, or when we are almost certainly
 * running inside the desktop shell so users see export/import (handlers toast if the
 * bridge is still missing).
 */
export function showDesktopBackupSettings(): boolean {
  if (hasElectronSqlite()) return true;
  if (typeof window === "undefined") return false;
  if (window.location?.protocol === "file:") return true;
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) {
    return true;
  }
  return false;
}

/** HashRouter is required for `file://` loads; also use when Electron is detected. */
export function shouldUseHashRouter(): boolean {
  if (import.meta.env.VITE_ELECTRON === "true") return true;
  if (typeof window === "undefined") return false;
  if (window.electronAPI) return true;
  if (window.location?.protocol === "file:") return true;
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) {
    return true;
  }
  return false;
}
