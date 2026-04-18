# Release process (macOS)

End-to-end flow for this repo: **tag → GitHub Actions → Cloudflare R2 + GitHub Releases → users (download / auto-update / Homebrew)**. Public downloads and auto-update use **R2** (see [`electron-builder.yml`](../electron-builder.yml)); GitHub Releases mirror artifacts for collaborators.

## 1. Version bump

1. Update `version` in [`package.json`](../package.json) (and run `npm run version:sync` so [`public/version.json`](../public/version.json) matches if you commit it).
2. Commit and push.

## 2. Create a release tag

Use semantic versions aligned with `package.json`:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs on `v*.*.*` tags.

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

1. Copy `build/entitlements.mac.plist`, `electron-builder.yml`, `.github/workflows/release.yml`, `scripts/release-macos.sh`, `scripts/rewrite-r2-update-metadata.mjs`, `scripts/sync-version-json.mjs`.
2. Set `repository`, GitHub `owner` / `repo` in `electron-builder.yml`, R2 bucket/path, and `build.appId` / `productName` in `package.json`.
3. Add `electron-updater` and main-process wiring like [`electron/main.ts`](../electron/main.ts).
4. Create a new `homebrew-tap` repo and cask pointing at your Release URLs.
