# Apple Key Rotation

Desktop and web utility to generate **Sign in with Apple** client secrets (JWT) locally. Your `.p8` private key never leaves your machine: signing runs in the browser or Electron renderer using the Web Crypto API. Nothing is sent to a server.

Repository: [github.com/aiherrera/apple-key-rotation](https://github.com/aiherrera/apple-key-rotation)

## Features

- **Local signing** — Key ID, Team ID, Services ID, and `.p8` are used only to build and sign the JWT; the secret is not uploaded anywhere.
- **Profiles** — Multiple saved identifier sets (e.g. production vs staging) in local storage.
- **Rotation history** — Last events and expiry metadata in IndexedDB (not the JWT itself).
- **Electron** — Native menus, window position memory, single-instance behavior, optional **Open .p8 file…** dialog, and clipboard integration.

## Requirements

- **Node.js** 20+ for local development (release CI uses Node 22).
- Apple Developer **Sign in with Apple** key (`.p8`), Key ID, Team ID, and Services ID (client ID / bundle ID).

## Quick start

```bash
git clone https://github.com/aiherrera/apple-key-rotation.git
cd apple-key-rotation
npm install   # or: bun install
npm run dev   # or: bun run dev — web UI at Vite’s URL
```

For the desktop app with hot reload: `npm run electron:dev` or `bun run electron:dev`.

## Scripts

Use `npm run <script>` or `bun run <script>`.

| Command | Description |
|--------|-------------|
| `dev` | Vite dev server (web) |
| `build` | Production web build to `dist/` |
| `build:dev` | Vite build in development mode |
| `preview` | Preview the production web build locally |
| `electron:dev` | Electron app with hot reload |
| `electron:build` | Web + Electron main/preload bundles |
| `electron:pack` | Build and package with electron-builder (`release/`) |
| `release:publish` | Build mac app and publish to GitHub Releases (use in CI or with `GH_TOKEN`) |
| `version:sync` | Write `public/version.json` from `package.json` (for landing / static sites) |
| `test` | Vitest (single run) |
| `test:watch` | Vitest in watch mode |
| `lint` | ESLint |

## macOS distribution

- **Release pipeline**: push a tag `v*.*.*` to run [`.github/workflows/release.yml`](.github/workflows/release.yml) (DMG, ZIP, `latest-mac.yml` on GitHub Releases). Details: [`docs/RELEASE.md`](docs/RELEASE.md).
- **Signing secrets**: [`docs/SECRETS.md`](docs/SECRETS.md).
- **Landing page on Dokploy** (CTA URLs, optional redirects): [`docs/DOKPLOY.md`](docs/DOKPLOY.md).
- **In-app updates**: `electron-updater` + GitHub Releases (configured in `package.json` under `build.publish`).
- **Homebrew**: copy [`homebrew/Casks/apple-key-rotation.rb`](homebrew/Casks/apple-key-rotation.rb) into a separate **tap** repo; see [`homebrew/README.md`](homebrew/README.md).

## Privacy

- **`.p8` file**: Read into memory for signing, then cleared from the UI after a successful generation (not written to application history).
- **Identifiers**: Stored in `localStorage` per profile.
- **History**: Success/failure timestamps and expiry dates in IndexedDB only.

## Tech stack

Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Electron (optional).

## Docker

See [`Dockerfile`](Dockerfile) and [`docker-compose.yml`](docker-compose.yml) for serving the web build behind nginx.

## License

UNLICENSED — see [`package.json`](package.json).
