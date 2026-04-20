import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/copyToClipboard";
import { getElectronLastClientSecret } from "@/lib/electronLastClientSecret";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/electronMenuEvents";

/**
 * Single subscriber for Electron application menu actions so IPC always runs
 * (the generator page unmounts on other routes, so handlers cannot live only there).
 */
export function ElectronMenuActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  pathnameRef.current = location.pathname;

  useEffect(() => {
    if (!window.electronAPI?.onMenuAction) return;

    const unsub = window.electronAPI.onMenuAction((action) => {
      if (action === "navigate-home") {
        void navigate("/");
        return;
      }
      if (action === "focus-settings") {
        void navigate({ pathname: "/settings" });
        return;
      }
      if (action === "focus-changelog") {
        void navigate({ pathname: "/settings", search: "?tab=changelog" });
        return;
      }
      if (action === "focus-about") {
        void navigate({ pathname: "/settings", search: "?tab=about" });
        return;
      }
      if (action === "command-palette") {
        if (pathnameRef.current !== "/") {
          void navigate("/", { state: { openCommandPalette: true } });
        } else {
          window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
        }
        return;
      }
      if (action === "open-p8") {
        void (async () => {
          const api = window.electronAPI;
          if (!api?.openP8File) return;
          const r = await api.openP8File();
          if (!r.canceled && r.content && r.fileName) {
            void navigate("/", {
              state: { importedP8: { content: r.content, fileName: r.fileName } },
            });
          }
        })();
        return;
      }
      if (action === "copy-secret") {
        void (async () => {
          const secret = getElectronLastClientSecret();
          if (!secret) {
            toast.error("No client secret yet", {
              description: "Generate a secret on the main screen first.",
            });
            return;
          }
          await copyToClipboard(secret);
          toast.success("Client secret copied");
        })();
      }
    });

    return unsub;
  }, [navigate]);

  return null;
}
