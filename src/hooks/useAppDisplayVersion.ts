import { useEffect, useState } from "react";

const viteFallback = import.meta.env.VITE_APP_VERSION ?? "0.0.0";

/**
 * Prefer Electron main `app.getVersion()` (matches the installed .app) over the
 * Vite-baked `VITE_APP_VERSION`, and fall back to `public/version.json` on the web.
 */
export function useAppDisplayVersion(): string {
  const [version, setVersion] = useState(viteFallback);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (window.electronAPI?.getAppVersion) {
        try {
          const v = await window.electronAPI.getAppVersion();
          if (!cancelled && v) {
            setVersion(v);
            return;
          }
        } catch {
          // keep fallback
        }
      }
      try {
        const r = await fetch("/version.json", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { version?: string };
          if (j.version && !cancelled) {
            setVersion(j.version);
          }
        }
      } catch {
        // keep fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
