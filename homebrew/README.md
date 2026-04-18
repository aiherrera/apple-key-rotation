# Homebrew tap (separate repository)

Homebrew installs macOS apps from a **tap**: a Git repository that contains Ruby **cask** definitions. Maintain the tap in its **own** GitHub repo (e.g. `aiherrera/homebrew-tap`), not inside the application source tree.

## One-time setup

1. Create a new public GitHub repository named e.g. `homebrew-tap`.
2. Copy [`Casks/apple-key-rotation.rb`](./Casks/apple-key-rotation.rb) into that repo under `Casks/apple-key-rotation.rb`.
3. Replace placeholders:
   - `YOUR_ORG` / `YOUR_TAP_REPO` in the comment at the top (documentation only).
   - `version` — must match the released app version.
   - `url` — HTTPS URL of the DMG on GitHub Releases (same file users get from the browser).
   - `sha256` — `shasum -a 256 path/to/downloaded.dmg` after downloading that exact file.

4. Users install with:

```bash
brew tap aiherrera/tap
brew install --cask apple-key-rotation
```

(Adjust `aiherrera/tap` to match `brew tap <user>/<repo>` for your tap repository name.)

## Every app release

1. Publish a new GitHub Release (see [docs/RELEASE.md](../docs/RELEASE.md)).
2. Download the new DMG from the Release page (or use `curl -LO` with the asset URL).
3. Compute SHA-256: `shasum -a 256 "Apple Key Rotation-x.y.z-arm64.dmg"`.
4. Edit the cask in the tap repo: bump `version`, update `url` if the filename changed, update `sha256`.
5. Commit and push the tap repo.

Optional: automate with a script or a `workflow_dispatch` workflow in the tap repo that receives the new version and asset URL.

## Landing page copy

Add a second block or tab next to the DMG download:

```bash
brew tap aiherrera/tap && brew install --cask apple-key-rotation
```
