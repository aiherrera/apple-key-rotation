# Apple Key Rotation

Desktop and web utility to generate **Sign in with Apple** client secrets (JWT) locally. Your `.p8` private key never leaves your machine: signing runs in the browser or Electron renderer using the Web Crypto API.

## Features

- **Local signing** — Key ID, Team ID, Services ID, and `.p8` are used only to build and sign the JWT; the secret is not uploaded anywhere.
- **Profiles** — Multiple saved identifier sets (e.g. production vs staging) in local storage.
- **Rotation history** — Last events and expiry metadata in IndexedDB (not the JWT itself).
- **Electron** — Native menus, window position memory, single-instance behavior, optional **Open .p8 file…** dialog, and clipboard integration.

## Requirements

- Node.js 18+
- Apple Developer **Sign in with Apple** key (`.p8`), Key ID, Team ID, and Services ID (client ID / bundle ID).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (web) |
| `npm run electron:dev` | Electron app with hot reload |
| `npm run build` | Production web build to `dist/` |
| `npm run electron:build` | Web + Electron main/preload bundles |
| `npm run electron:pack` | Build and package with electron-builder (`release/`) |
| `npm run release:publish` | Build mac app and publish to GitHub Releases (use in CI or with `GH_TOKEN`) |
| `npm run version:sync` | Write `public/version.json` from `package.json` (for landing / static sites) |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

## macOS distribution

- **Release pipeline**: push a tag `v*.*.*` to run [`.github/workflows/release.yml`](.github/workflows/release.yml) (DMG, ZIP, `latest-mac.yml` on GitHub Releases). Details: [`docs/RELEASE.md`](docs/RELEASE.md).
- **Signing secrets**: [`docs/SECRETS.md`](docs/SECRETS.md).
- **Landing page on Dokploy** (CTA URLs, optional redirects): [`docs/DOKPLOY.md`](docs/DOKPLOY.md).
- **In-app updates**: `electron-updater` + GitHub Releases (configured in `package.json` `build.publish`).
- **Homebrew**: copy [`homebrew/Casks/apple-key-rotation.rb`](homebrew/Casks/apple-key-rotation.rb) into a separate **tap** repo; see [`homebrew/README.md`](homebrew/README.md).

## Privacy

- **`.p8` file**: Read into memory for signing, then cleared from the UI after a successful generation (not written to application history).
- **Identifiers**: Stored in `localStorage` per profile.
- **History**: Success/failure timestamps and expiry dates in IndexedDB only.

## Tech stack

Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Electron (optional).

## Docker

See [`Dockerfile`](Dockerfile) and [`docker-compose.yml`](docker-compose.yml) for serving the web build behind nginx.
