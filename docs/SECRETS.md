# GitHub Actions secrets (macOS release)

Configure these in the repository: **Settings → Secrets and variables → Actions**.

## Cloudflare R2 (required for public downloads + auto-update)

`electron-builder` publishes artifacts to **GitHub Releases** only (second `build.publish` entry). CI then runs [`scripts/sync-release-to-r2.mjs`](../scripts/sync-release-to-r2.mjs) to copy the same files from `release/` into R2. The **first** `build.publish` entry is **generic** and points at your public R2 URL so `electron-updater` in the packaged app checks **R2** for `latest-mac.yml`, not GitHub—so anonymous users and private repos still work.

### One-time Cloudflare setup (dashboard)

1. **R2** → Create bucket (e.g. `apple-key-rotation-releases`).
2. **R2** → **Manage R2 API Tokens** → Create token with **Object Read & Write** (S3-compatible). Save the **Access Key ID** and **Secret Access Key**.
3. **Public URLs:** Either connect a **custom domain** to the bucket (recommended) or enable the bucket’s **r2.dev** public URL. Anonymous `GET` must succeed for `latest-mac.yml` and for `.dmg` / `.zip` objects under prefix `apple-key-rotation/` (see [`scripts/sync-release-to-r2.mjs`](../scripts/sync-release-to-r2.mjs)).
4. **CORS** (optional): If a browser on another origin fetches DMGs/YAML, add a CORS rule on the bucket or custom domain as needed.

### GitHub Actions secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (R2 overview / dashboard URL). |
| `CLOUDFLARE_R2_BUCKET` | R2 bucket name. |
| `R2_ACCESS_KEY_ID` | R2 S3 API access key id (mapped to `AWS_ACCESS_KEY_ID` in the workflow for [`scripts/sync-release-to-r2.mjs`](../scripts/sync-release-to-r2.mjs) and [`scripts/rewrite-r2-update-metadata.mjs`](../scripts/rewrite-r2-update-metadata.mjs)). |
| `R2_SECRET_ACCESS_KEY` | R2 S3 API secret (mapped to `AWS_SECRET_ACCESS_KEY`). |
| `R2_PUBLIC_BASE_URL` | **Required for tagged releases.** Public base URL (no trailing slash) where R2 objects are readable, including path prefix `apple-key-rotation` (e.g. `https://releases.example.com/apple-key-rotation`). Baked into the app via the **generic** `build.publish` entry. [`scripts/rewrite-r2-update-metadata.mjs`](../scripts/rewrite-r2-update-metadata.mjs) rewrites YAML `url:` lines (GitHub or relative) to this host and re-uploads YAML to R2. |

### Verify after the first release

From a machine **without** Cloudflare credentials:

1. Open `latest-mac.yml` at your public base, e.g.  
   `https://<public-host>/apple-key-rotation/latest-mac.yml`
2. Copy a `url:` from that file and run `curl -I <that-url>` — expect **200** and `application/x-apple-diskimage` (or similar) for the DMG.

If `url:` entries in `latest-mac.yml` still point at a host that is not publicly readable, ensure `R2_PUBLIC_BASE_URL` is set, `rewrite-r2-update-metadata.mjs` ran after the mirror step, and the bucket or custom domain allows anonymous `GET`.

**Note:** Update YAML may use **GitHub** `url:` lines or **relative** paths; the rewrite script normalizes both to `R2_PUBLIC_BASE_URL` and re-uploads the YAML to R2.

## Required for publishing to GitHub Releases

| Secret | Description |
|--------|-------------|
| *(none)* | The default `GITHUB_TOKEN` is enough for `electron-builder`’s GitHub publisher when the workflow has `contents: write`. |

**Draft releases:** If a release stays in **draft**, the workflow still runs `gh release edit … --draft=false` after [`scripts/release-macos.sh`](../scripts/release-macos.sh). Delete a broken release on GitHub and re-run if needed.

## Optional — Apple code signing + notarization

Without these, CI still produces a **.dmg**, but it will be **ad-hoc signed** (users see stronger Gatekeeper warnings). For distribution outside your machine, set up **Developer ID Application** signing and notarization.

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded **.p12** export of your **Developer ID Application** certificate + private key (from Keychain Access). |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set when exporting the .p12. |
| `APPLE_ID` | Apple ID email used for notarization. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password ([Apple ID account](https://appleid.apple.com/)) — not your Apple ID login password. |
| `APPLE_TEAM_ID` | 10-character Team ID (Membership details in [Apple Developer](https://developer.apple.com/account/)). |

The release workflow decodes `APPLE_CERTIFICATE_BASE64` into `certificate.p12` and sets `CSC_LINK` / `CSC_KEY_PASSWORD` for `electron-builder`. Notarization runs automatically when `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` are set (see [electron-builder code signing](https://www.electron.build/code-signing)).

## Local development signing

On your Mac, install the Developer ID certificate in Keychain and set `CSC_NAME` or let `electron-builder` auto-discover. Notarization env vars can be exported in the shell before `npm run electron:pack`.

## Local `npm run release:publish`

Set **`R2_PUBLIC_BASE_URL`** so the **generic** publish URL in [`package.json`](../package.json) expands; otherwise `electron-builder` fails validation. For the R2 mirror + YAML rewrite, set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`—see [`.env.example`](../.env.example). If those are unset, `sync-release-to-r2.mjs` skips (GitHub publish still ran).
