# Dokploy landing page + download CTA

The **marketing site** is usually a separate deploy on Dokploy (static Next/Vite export or similar). The **binaries** stay on **GitHub Releases** unless you later mirror them to R2 or another CDN.

## Direct link (simplest)

Point your primary CTA to the **latest release asset** URL. GitHub supports:

```text
https://github.com/aiherrera/apple-key-rotation/releases/latest/download/<EXACT_ASSET_FILENAME>
```

Replace `<EXACT_ASSET_FILENAME>` with the DMG name shown on the Release (spaces encoded as `%20`). Example:

```text
https://github.com/aiherrera/apple-key-rotation/releases/latest/download/Apple%20Key%20Rotation-1.0.0-arm64.dmg
```

**Note:** If you publish **multiple** DMG variants (Intel vs Apple Silicon) with different filenames, `latest/download/` only works if there is a **single** asset with that exact name per release. Otherwise link to the Release page or use a redirect (below).

## Optional: `/download/mac` redirect

If you want a stable URL on **your** domain that you can change without editing the landing page:

1. In Dokploy (or the reverse proxy in front of it), configure a **302** redirect from `/download/mac` to the current GitHub asset URL above.
2. Point the CTA to `https://yourdomain.com/download/mac`.

### Caddy (example)

```caddy
redir /download/mac https://github.com/aiherrera/apple-key-rotation/releases/latest/download/Apple%20Key%20Rotation-1.0.0-arm64.dmg 302
```

### nginx (example)

```nginx
location = /download/mac {
  return 302 https://github.com/aiherrera/apple-key-rotation/releases/latest/download/Apple%20Key%20Rotation-1.0.0-arm64.dmg;
}
```

Update the target URL when filenames or architectures change.

## Optional: `version.json` on the site

This repo includes [`public/version.json`](../public/version.json), synced from `package.json` via `npm run version:sync`. If your landing build copies `public/` into the static site, you can display the current app version by fetching `/version.json`—useful to avoid showing a stale version string next to “Download.”

## Cloudflare

Not required. Use Cloudflare in front of Dokploy if you want managed DNS, caching for static assets, or WAF. You do **not** need Cloudflare for the download link or for `electron-updater` (updates use GitHub Releases metadata by default).
