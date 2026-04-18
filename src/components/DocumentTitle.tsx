import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { APP_DISPLAY_NAME } from "@/constants/appMeta";

/**
 * Keeps `document.title` in sync with the route (updates the native window title in Electron).
 */
export function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === "/settings") {
      document.title = `Settings — ${APP_DISPLAY_NAME}`;
    } else if (pathname === "/") {
      document.title = APP_DISPLAY_NAME;
    } else {
      document.title = `Not found — ${APP_DISPLAY_NAME}`;
    }
  }, [pathname]);

  return null;
}
