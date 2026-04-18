import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/electronMenuEvents";

/**
 * Handles Electron menu items that require routing or cross-route behavior.
 * Copy secret / open .p8 stay in {@link AppleKeyRotation} where that state lives.
 */
export function ElectronMenuActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const isElectron = import.meta.env.VITE_ELECTRON === "true";

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    return window.electronAPI.onMenuAction((action) => {
      if (action === "navigate-home") {
        void navigate("/");
      } else if (action === "focus-settings") {
        void navigate("/settings");
      } else if (action === "focus-changelog") {
        void navigate("/settings?tab=changelog");
      } else if (action === "focus-about") {
        void navigate("/settings?tab=about");
      } else if (action === "command-palette") {
        if (location.pathname !== "/") {
          void navigate("/", { state: { openCommandPalette: true } });
        } else {
          window.dispatchEvent(
            new CustomEvent(OPEN_COMMAND_PALETTE_EVENT),
          );
        }
      }
    });
  }, [isElectron, navigate, location.pathname]);

  return null;
}
