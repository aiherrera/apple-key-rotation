export const APP_AUTHOR = "Alain Iglesias Herrera";

export type ReleaseChannel = "latest" | "beta" | "alpha";

export interface ReleaseEntry {
  version: string;
  dateLabel: string;
  channel: ReleaseChannel;
  items: string[];
}

export const RELEASE_HISTORY: ReleaseEntry[] = [
  {
    version: "1.0.0",
    dateLabel: "April 2026",
    channel: "latest",
    items: [
      "Initial public release",
      "Drag-and-drop .p8 signing with ES256",
      "Multiple profiles (Key ID / Team ID / Services ID)",
      "Rotation history with expiry tracking",
      "Universal binary — Apple Silicon + Intel",
    ],
  },
  {
    version: "0.9.0",
    dateLabel: "2026",
    channel: "beta",
    items: [
      "Public beta — feedback round with 40 developers",
      "Added Keychain encryption for stored identifiers",
      "Polished onboarding and empty states",
    ],
  },
  {
    version: "0.5.0",
    dateLabel: "2026",
    channel: "alpha",
    items: ["Internal alpha — core JWT signing pipeline", "Single profile, single key support"],
  },
];
