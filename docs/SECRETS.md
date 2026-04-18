# GitHub Actions secrets (macOS release)

Configure these in the repository: **Settings → Secrets and variables → Actions**.

## Required for publishing to GitHub Releases

| Secret | Description |
|--------|-------------|
| *(none)* | The default `GITHUB_TOKEN` is enough for `electron-builder` to upload assets to the same repo’s Releases when the workflow has `contents: write`. |

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
