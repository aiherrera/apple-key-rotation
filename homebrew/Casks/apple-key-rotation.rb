# Copy this file to your Homebrew tap repository: Casks/apple-key-rotation.rb
# Tap repo example: https://github.com/aiherrera/homebrew-tap
#
# After each release: update version, url, and sha256 (shasum -a 256 on the downloaded DMG).

cask "apple-key-rotation" do
  version "1.0.0"
  # Replace with output of: shasum -a 256 /path/to/the.dmg
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"

  # Filename must match the DMG on the GitHub Release (check arch suffix: -arm64, -x64, or none if universal).
  url "https://github.com/aiherrera/apple-key-rotation/releases/download/v#{version}/apple-key-rotation-#{version}-arm64.dmg"
  name "Apple Key Rotation"
  desc "Generate Sign in with Apple client secrets locally from your .p8 key"
  homepage "https://github.com/aiherrera/apple-key-rotation"

  depends_on macos: ">= :big_sur"

  app "Apple Key Rotation.app"

  zap trash: [
    "~/Library/Application Support/apple-key-rotation",
    "~/Library/Preferences/com.aiherrera.apple-key-rotation.plist",
  ]
end
