# Release process (macOS)

End-to-end flow for this repo: **tag → GitHub Actions → GitHub Releases → users (download / auto-update / Homebrew)**.

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
- **`latest-mac.yml`** and blockmap files for `electron-updater` (same Release)

Artifacts appear under **GitHub → Releases →** the tag you pushed.

## 4. Secrets

See [SECRETS.md](./SECRETS.md). Unsigned builds work without Apple secrets; signed + notarized builds need the listed Apple secrets.

## 5. Landing page download link

Use a stable URL pattern (replace `OWNER`, `REPO`, and the **exact asset filename** from the Release, e.g. `Apple Key Rotation-1.0.1-arm64.dmg`):

```text
https://github.com/OWNER/REPO/releases/download/v1.0.1/Apple%20Key%20Rotation-1.0.1-arm64.dmg
```

Or link to the Release page and let users pick the asset. See [DOKPLOY.md](./DOKPLOY.md) for hosting on Dokploy and optional redirects.

## 6. Homebrew

After each release, update the cask in your **tap** repository (see [`homebrew/README.md`](../homebrew/README.md)).

## Reusing on other apps

1. Copy `build/entitlements.mac.plist`, `.github/workflows/release.yml`, `scripts/release-macos.sh`, `scripts/sync-version-json.mjs`.
2. Set `repository`, `build.publish.owner` / `repo`, and `build.appId` / `productName` in `package.json`.
3. Add `electron-updater` and main-process wiring like [`electron/main.ts`](../electron/main.ts).
4. Create a new `homebrew-tap` repo and cask pointing at your Release URLs.
