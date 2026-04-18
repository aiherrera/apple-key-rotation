# Release process (macOS)

End-to-end flow for this repo: **tag → GitHub Actions → Cloudflare R2 + GitHub Releases → users (download / auto-update / Homebrew)**. Public downloads and auto-update use **R2** (see `build.publish` in [`package.json`](../package.json)); GitHub Releases mirror artifacts for collaborators.

**Note:** `electron-builder` loads `build` from `package.json` for this project. A separate `electron-builder.yml` would be ignored in that case, so **R2 + GitHub publish targets must stay in `package.json`.**

## 1. Version bump

1. Update `version` in [`package.json`](../package.json) (and run `npm run version:sync` so [`public/version.json`](../public/version.json) matches if you commit it).
2. Commit and push.

## 2. Create a release tag

Use semantic versions aligned with `package.json` (bump `version` in [`package.json`](../package.json) first, or rely on CI—see below):

```bash
git tag v1.0.1
git push origin v1.0.1
```

The workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs on `v*.*.*` tags. It runs `npm version` from the tag **before** `npm ci`, so the **packaged app’s About / `app.getVersion()`** matches `v1.2.3` even if you forgot to commit a `package.json` bump. You should still commit the same version on `main` afterward so local builds and tags stay in sync.

The macOS **About** panel uses `app.getVersion()`, which comes from the bundled app metadata (driven by `package.json` at build time). If you ever see **0.0.0** on a download while the GitHub release is **v1.0.0**, that build almost certainly used an old `package.json` or an **old DMG**—re-run the workflow or cut a new tag after fixing publish config.

## 3. What CI publishes

- **DMG** and **ZIP** for macOS
- **`latest-mac.yml`** and blockmap files for `electron-updater` on **R2** (prefix `apple-key-rotation/` in the bucket)
- The same binaries and metadata are also attached to **GitHub → Releases →** the tag you pushed

Configure R2 and optional `R2_PUBLIC_BASE_URL` in [`SECRETS.md`](./SECRETS.md).

## 4. Secrets

See [SECRETS.md](./SECRETS.md). Unsigned builds work without Apple secrets; signed + notarized builds need the listed Apple secrets.

## 5. Landing page download link

Prefer a **public R2** (or custom domain) URL—see [DOKPLOY.md](./DOKPLOY.md). For a **private** GitHub repo, GitHub asset URLs are not suitable for anonymous visitors; R2 is the primary host.

Optional internal pattern (replace `OWNER`, `REPO`, version, and filename):

```text
https://github.com/OWNER/REPO/releases/download/v1.0.1/Apple%20Key%20Rotation-1.0.1-arm64.dmg
```

## 6. Homebrew

After each release, update the cask in your **tap** repository (see [`homebrew/README.md`](../homebrew/README.md)).

## Reusing on other apps

1. Copy `build/entitlements.mac.plist`, `.github/workflows/release.yml`, `scripts/release-macos.sh`, `scripts/rewrite-r2-update-metadata.mjs`, `scripts/sync-version-json.mjs`, and merge the `build` / `build.publish` blocks you need into `package.json`.
2. Set `repository`, GitHub `owner` / `repo` under `build.publish` (github provider), R2 bucket/path (s3 provider), and `build.appId` / `productName` in `package.json`.
3. Add `electron-updater` and main-process wiring like [`electron/main.ts`](../electron/main.ts).
4. Create a new `homebrew-tap` repo and cask pointing at your Release URLs.
