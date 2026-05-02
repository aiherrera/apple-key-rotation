export const APP_AUTHOR = "Alain Iglesias Herrera";

/** `latest` green badge is derived at runtime from the app version; these labels are for non-current rows. */
export type ReleaseChannel = "stable" | "beta" | "alpha";

export interface ReleaseEntry {
  version: string;
  dateLabel: string;
  channel: ReleaseChannel;
  items: string[];
}

/** Newest first; only list versions that exist as GitHub release tags. */
export const RELEASE_HISTORY: ReleaseEntry[] = [
  {
    version: "1.0.1",
    dateLabel: "April 2026",
    channel: "stable",
    items: [
      "Refreshed the app icon—in the Dock, Finder, and the About window",
      "Icon artwork is now produced from a single high-resolution source for sharper Retina and standard displays",
      "Removed a few unused image files to keep the app package leaner",
    ],
  },
  {
    version: "1.0.0",
    dateLabel: "April 2026",
    channel: "stable",
    items: [
      "Initial public release",
      "Drag-and-drop .p8 signing with ES256",
      "Multiple profiles (Key ID / Team ID / Services ID)",
      "Rotation history with expiry tracking",
      "Universal binary — Apple Silicon + Intel",
    ],
  },
];
