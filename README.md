# Apple Key Rotation

Desktop and web utility to generate **Sign in with Apple** client secrets (JWT) locally. Key ID, Team ID, Services ID, and your `.p8` stay on your device: signing uses the Web Crypto API in the browser, or Electron (renderer or **main process** when you use an encrypted saved key). The client secret is **not uploaded** anywhere.

## Features

- **Local signing** — Build and sign the JWT from your identifiers and private key only; nothing is sent to an app-controlled server.
- **Profiles** — Multiple saved setups (for example production vs staging) with editing, stronger validation, and optional **rotation memos** (local notes attached to successful generations).
- **JWT tooling** — **Decode preview** of the generated token payload for a quick sanity check (local-only parsing).
- **Rotation history** — Timestamps, expiry, identifiers, memo, status, and (on success) **the client secret JWT** persisted locally so you can copy a prior secret. **Web:** IndexedDB; **Electron:** SQLite. Clear from **Settings → Data & privacy** or the history UI when appropriate.
- **Settings** — **Notifications** (expiry reminders, OS permission, startup toasts, “expiring soon” thresholds), **Data & privacy**, **Changelog**, and **About**.
- **Notification history** — Review past in-app alerts; **notification bell** in the shell for quick access.
- **Electron desktop app**
  - **SQLite** in app **userData** (via **better-sqlite3**) for profiles/settings, rotation history, and encrypted `.p8` PEM material.
  - **First launch migration** — If the database is empty, data can be pulled from legacy **localStorage** + IndexedDB used by the web build.
  - **Encrypted key storage** — Optional per-profile `.p8` persisted with Electron `**safeStorage`** (OS-backed secret storage); on macOS, **Touch ID** can be required to **reveal** or **export** a saved key (`node-mac-auth`).
  - **Backups** — **Settings → Data & privacy**: full database export/import plus **portable JSON** snapshot backup.
  - Native menus, window position memory, single-instance behavior, **Open .p8 file…**, clipboard shortcuts, `**electron-updater`** — and **HashRouter** for packaged `file://` loads so deep links behave reliably.

## Requirements

- Node.js 18+
- Apple Developer **Sign in with Apple** key (`.p8`), Key ID, Team ID, and Services ID (client ID / bundle ID).

## Scripts


| Command                   | Description                                                                                                                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`             | Vite dev server (web)                                                                                                                                                                                                                                                      |
| `npm run electron:dev`    | Electron app with hot reload                                                                                                                                                                                                                                               |
| `npm run preview`         | Serve production web build from `dist/`                                                                                                                                                                                                                                    |
| `npm run build`           | Production web build to `dist/`                                                                                                                                                                                                                                            |
| `npm run build:dev`       | Same as `build` with Vite `--mode development`                                                                                                                                                                                                                             |
| `npm run electron:build`  | Web + Electron main/preload bundles                                                                                                                                                                                                                                        |
| `npm run electron:pack`   | Build and package with electron-builder (`release/`)                                                                                                                                                                                                                       |
| `npm run release:publish` | Build mac app; `electron-builder` publishes to **GitHub Releases**. With R2 env vars set, `[scripts/release-macos.sh](scripts/release-macos.sh)` also uploads the same `release/` artifacts to **R2** and rewrites update YAML (see `[docs/SECRETS.md](docs/SECRETS.md)`). |
| `npm run version:sync`    | Write `public/version.json` from `package.json` (for landing / static sites)                                                                                                                                                                                               |
| `npm run icons:mac`       | Regenerate macOS icon assets (`scripts/normalize-mac-icon.py` + `scripts/regenerate-mac-app-icon.sh`)                                                                                                                                                                      |
| `npm test`                | Vitest                                                                                                                                                                                                                                                                     |
| `npm run test:watch`      | Vitest watch mode                                                                                                                                                                                                                                                          |
| `npm run lint`            | ESLint                                                                                                                                                                                                                                                                     |


After installs, `**postinstall`** runs `electron-builder install-app-deps` to rebuild native addons (for example **better-sqlite3**) against Electron.

## macOS distribution

- **Release pipeline**: push a tag `v*.*.*` to run `[.github/workflows/release.yml](.github/workflows/release.yml)` (DMG, ZIP, and `latest-mac.yml` on **GitHub Releases**, then mirrored to **Cloudflare R2** for public downloads / auto-update). Details: `[docs/RELEASE.md](docs/RELEASE.md)`.
- **R2 + signing secrets**: `[docs/SECRETS.md](docs/SECRETS.md)`.
- **Landing page on Dokploy** (CTA URLs, optional redirects): `[docs/DOKPLOY.md](docs/DOKPLOY.md)`.
- **In-app updates**: `electron-updater` uses the **first** `build.publish` entry—a **generic** URL pointing at your public R2 prefix (see `[package.json](package.json)`); binaries are still published via the **GitHub** provider in the same config.
- **Homebrew**: copy `[homebrew/Casks/apple-key-rotation.rb](homebrew/Casks/apple-key-rotation.rb)` into a separate **tap** repo; see `[homebrew/README.md](homebrew/README.md)`.

## Privacy

All data below is **local** to the browser profile or Electron **userData** unless you explicitly **export** a backup file.

### Web build

- **Profiles / app settings**: `localStorage` (known keys managed by the app).
- **Rotation history**: IndexedDB — includes metadata and, for **successful** generations, **the client secret JWT** so you can copy it later.
- `**.p8` uploads**: Held in memory for signing; cleared from the generator UI after a successful run (see in-app hints). Only what you persist in history is retained as above.

### Electron build

- **Primary store**: SQLite (profiles/settings, rotations, encrypted PEM payloads for saved keys).
- **Saved `.p8`**: Stored **encrypted** via `**safeStorage`**; PEM is decrypted only when generating, revealing, or exporting. On macOS, reveal/export can require **Touch ID**.
- **Rotation history**: Same semantics as web (successful rows may include the **JWT**). Use **Clear all app data** or rotation controls if this device should not retain secrets.

### Clearing data

Use **Settings → Data & privacy → Clear all app data** when you want to wipe application storage (Electron can also wipe the SQLite-backed store consistent with that flow).

## Tech stack

Vite, React, TypeScript, Tailwind CSS, shadcn/ui, **TanStack Query**, **React Router**, Electron (optional), **Vitest**.

Electron adds **better-sqlite3**, **electron-updater**, `**safeStorage`**-backed PEM storage, and **node-mac-auth** on macOS (Touch ID prompts).

## Docker

See `[Dockerfile](Dockerfile)` and `[docker-compose.yml](docker-compose.yml)` for serving the web build behind nginx.