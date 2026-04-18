# GitHub Actions secrets (macOS release)

Configure these in the repository: **Settings → Secrets and variables → Actions**.

## Cloudflare R2 (required for public downloads + auto-update)

Artifacts are published **first** to R2 (S3-compatible API) by `electron-builder`, then mirrored to **GitHub Releases** with `gh release upload` (see [`scripts/upload-github-release-assets.mjs`](../scripts/upload-github-release-assets.mjs)). `electron-updater` uses **R2 only**, so end users resolve updates from R2 without needing access to a private GitHub repo.

### One-time Cloudflare setup (dashboard)

1. **R2** → Create bucket (e.g. `apple-key-rotation-releases`).
2. **R2** → **Manage R2 API Tokens** → Create token with **Object Read & Write** (S3-compatible). Save the **Access Key ID** and **Secret Access Key**.
3. **Public URLs:** Either connect a **custom domain** to the bucket (recommended) or enable the bucket’s **r2.dev** public URL. Anonymous `GET` must succeed for `latest-mac.yml` and for `.dmg` / `.zip` objects at the paths electron-builder uploads (under prefix `apple-key-rotation/`).
4. **CORS** (optional): If a browser on another origin fetches DMGs/YAML, add a CORS rule on the bucket or custom domain as needed.

### GitHub Actions secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (R2 overview / dashboard URL). |
| `CLOUDFLARE_R2_BUCKET` | R2 bucket name. |
| `R2_ACCESS_KEY_ID` | R2 S3 API access key id (mapped to `AWS_ACCESS_KEY_ID` in the workflow for electron-builder / AWS SDK). |
| `R2_SECRET_ACCESS_KEY` | R2 S3 API secret (mapped to `AWS_SECRET_ACCESS_KEY`). |
| `R2_PUBLIC_BASE_URL` | **Optional but recommended.** Public base URL where objects are readable, **without** trailing slash, including the same path prefix as `build.publish[].path` for the **s3** entry in [`package.json`](../package.json) (e.g. `https://releases.example.com/apple-key-rotation` or your `https://….r2.dev/apple-key-rotation`). If set, CI rewrites `latest-mac.yml` (and other `release/*.yml`) to use this host and re-uploads them to R2, so auto-update works when the S3 API hostname is not anonymously readable. |

### Verify after the first release

From a machine **without** Cloudflare credentials:

1. Open `latest-mac.yml` at your public base, e.g.  
   `https://<public-host>/apple-key-rotation/latest-mac.yml`
2. Copy a `url:` from that file and run `curl -I <that-url>` — expect **200** and `application/x-apple-diskimage` (or similar) for the DMG.

If URLs still point at `*.r2.cloudflarestorage.com` and fail anonymously, ensure `R2_PUBLIC_BASE_URL` is set and the rewrite step ran, or fix public access on the bucket.

**Note:** electron-builder usually writes **relative** `url:` / `path:` entries (DMG/ZIP basename only) in `latest-mac.yml`. The rewrite script still expands them to absolute URLs under `R2_PUBLIC_BASE_URL` and re-uploads the YAML to R2.

## Required for publishing to GitHub Releases

| Secret | Description |
|--------|-------------|
| *(none)* | The default `GITHUB_TOKEN` is enough for `gh release create` / `gh release upload` when the workflow has `contents: write`. |

**Draft releases:** CI creates a **draft** GitHub release (if needed), uploads assets, then runs `gh release edit … --draft=false`. If a release is stuck, delete it on GitHub or re-run the workflow (`gh release upload` uses `--clobber` for assets).

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

Publishing expects `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` (R2 keys) in the environment—see [`.env.example`](../.env.example). Without them, electron-builder cannot expand the s3 publish entry in [`package.json`](../package.json) and the command will fail.
