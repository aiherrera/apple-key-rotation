# Release process (macOS)

End-to-end flow: **tag → GitHub Actions → GitHub Releases (electron-builder) → mirror `release/` to Cloudflare R2 → users**. Public downloads and **auto-update** use **R2** (anonymous `GET`); GitHub hosts the same files for collaborators and Homebrew.

**Note:** `build.publish` is **generic** (public R2 URL for `electron-updater` only; no upload) then **github** (artifacts to GitHub Releases). R2 copies use [`scripts/sync-release-to-r2.mjs`](../scripts/sync-release-to-r2.mjs); [`scripts/rewrite-r2-update-metadata.mjs`](../scripts/rewrite-r2-update-metadata.mjs) rewrites YAML for the public host.

## 1. Version bump

1. Update `version` in [`package.json`](../package.json) (and run `npm run version:sync` so [`public/version.json`](../public/version.json) matches if you commit it).
2. Commit and push.

## 2. Create a release tag

Use semantic versions aligned with `package.json` (bump `version` in [`package.json`](../package.json) first, or rely on CI—see below):

```bash
git tag v1.0.1
git push origin v1.0.1
```

The workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs on `v*.*.*` tags. It runs `npm ci` first, then `npm version` from the tag, so the **packaged app’s About / `app.getVersion()`** matches `v1.2.3` without breaking `node_modules`. You should still commit the same version on `main` afterward so local builds and tags stay in sync.

Re-running the workflow overwrites R2 objects and replaces GitHub release assets for that tag (electron-builder + mirror); if GitHub reports **422 already_exists** on rare paths, delete the release on GitHub for that tag and re-run, or bump the tag.

The macOS **About** panel uses `app.getVersion()`, which comes from the bundled app metadata (driven by `package.json` at build time). If you ever see **0.0.0** on a download while the GitHub release is **v1.0.0**, that build almost certainly used an old `package.json` or an **old DMG**—re-run the workflow or cut a new tag after fixing publish config.

## 3. What CI publishes

- **GitHub Releases** (via `electron-builder` **github** provider): DMG, ZIP, `latest-mac.yml`, blockmaps for the tag.
- **R2** (prefix `apple-key-rotation/`): the same files, uploaded by `sync-release-to-r2.mjs`; YAML is then patched for public URLs when `R2_PUBLIC_BASE_URL` is set.

Configure R2 and **`R2_PUBLIC_BASE_URL`** (required for the **generic** publish URL at build time) in [`SECRETS.md`](./SECRETS.md).

## 4. Secrets

See [SECRETS.md](./SECRETS.md). Unsigned builds work without Apple secrets; signed + notarized builds need the listed Apple secrets.

## 5. Landing page download link

Prefer a **public R2** (or custom domain) URL—see [DOKPLOY.md](./DOKPLOY.md). For a **private** GitHub repo, GitHub asset URLs are not suitable for anonymous visitors; R2 is the primary host.

Optional internal pattern (replace `OWNER`, `REPO`, version, and filename):

```text
https://github.com/OWNER/REPO/releases/download/v1.0.1/apple-key-rotation-1.0.1-arm64.dmg
```

## 6. Homebrew

After each release, update the cask in your **tap** repository (see [`homebrew/README.md`](../homebrew/README.md)).

## Reusing on other apps

1. Copy `build/entitlements.mac.plist`, `.github/workflows/release.yml`, `scripts/release-macos.sh`, `scripts/sync-release-to-r2.mjs`, `scripts/rewrite-r2-update-metadata.mjs`, `scripts/sync-version-json.mjs`, and the `build` / `build.publish` pattern from [`package.json`](../package.json).
2. Set `repository`, **generic** `url` (public update base, usually `${env.R2_PUBLIC_BASE_URL}`), **github** `owner` / `repo`, and `build.appId` / `productName`.
3. Add `electron-updater` and main-process wiring like [`electron/main.ts`](../electron/main.ts).
4. Create a new `homebrew-tap` repo and cask pointing at your Release URLs.
