# Dokploy landing page + download CTA

The **marketing site** is usually a separate deploy on Dokploy (static Next/Vite export or similar). **Binaries** are published to **Cloudflare R2** (public URL) and mirrored to **GitHub Releases** for collaborators; the primary CTA should use R2 (or your custom domain in front of R2) so visitors do not need access to a private GitHub repo.

## Primary: R2 / custom domain

Point your main **Download** button at a URL that is **anonymously readable** (verify with `curl -I`):

```text
https://<your-public-host>/apple-key-rotation/latest-mac.yml
```

Use the DMG URL from that file’s `url:` field, or a stable redirect you maintain (see below). Example pattern (replace host and filename with values from your latest release):

```text
https://releases.example.com/apple-key-rotation/Apple%20Key%20Rotation-1.0.0-arm64.dmg
```

Prefix `apple-key-rotation/` matches [`electron-builder.yml`](../electron-builder.yml). If you change the `path` there, update links and `R2_PUBLIC_BASE_URL` in CI (see [`docs/SECRETS.md`](SECRETS.md)).

## Secondary: GitHub Releases (private repo)

If the repo is **private**, `https://github.com/…/releases/latest/download/…` only works for users signed in with access. You can still link there for **internal** testers:

```text
https://github.com/aiherrera/apple-key-rotation/releases/latest/download/<EXACT_ASSET_FILENAME>
```

Replace `<EXACT_ASSET_FILENAME>` with the DMG name on the release (spaces as `%20`).

## Optional: `/download/mac` redirect

If you want a stable URL on **your** domain:

1. In Dokploy (or the reverse proxy in front of it), configure a **302** redirect from `/download/mac` to the current **public R2** DMG URL (or GitHub asset URL for internal use).
2. Point the CTA to `https://yourdomain.com/download/mac`.

### Caddy (example)

```caddy
redir /download/mac https://releases.example.com/apple-key-rotation/Apple%20Key%20Rotation-1.0.0-arm64.dmg 302
```

### nginx (example)

```nginx
location = /download/mac {
  return 302 https://releases.example.com/apple-key-rotation/Apple%20Key%20Rotation-1.0.0-arm64.dmg;
}
```

Update the target URL when filenames or architectures change.

## Optional: `version.json` on the site

This repo includes [`public/version.json`](../public/version.json), synced from `package.json` via `npm run version:sync`. If your landing build copies `public/` into the static site, you can display the current app version by fetching `/version.json`—useful to avoid showing a stale version string next to “Download.”

## Cloudflare

**R2** is used for hosting release artifacts and `latest-mac.yml` for **electron-updater**. You can also put **Cloudflare** in front of Dokploy for DNS, caching, or WAF; that is independent of the R2 download URLs.
