#!/usr/bin/env node
/**
 * electron-builder races / asserts when publishing to S3 and GitHub in one run.
 * We publish to R2 (s3 provider) only, then mirror artifacts with `gh` (sequential, --clobber).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const tag = process.env.GITHUB_REF_NAME;
if (!tag) {
  console.log(
    "upload-github-release-assets: skip (set GITHUB_REF_NAME for CI tag builds)",
  );
  process.exit(0);
}

const releaseDir = path.join(process.cwd(), "release");
if (!fs.existsSync(releaseDir)) {
  console.error("upload-github-release-assets: release/ not found");
  process.exit(1);
}

const names = fs.readdirSync(releaseDir);
const files = names.filter((n) => {
  const p = path.join(releaseDir, n);
  if (!fs.statSync(p).isFile()) return false;
  if (n.startsWith("builder-") || n.includes("effective-config")) return false;
  if (n === "latest-mac.yml") return true;
  if (n.endsWith(".dmg") || n.endsWith(".zip")) return true;
  if (n.endsWith(".blockmap")) return true;
  return false;
});

if (files.length === 0) {
  console.error(
    "upload-github-release-assets: no DMG/ZIP/blockmap/latest-mac.yml in release/",
  );
  process.exit(1);
}

const paths = files.map((f) => path.join(releaseDir, f));

function gh(args) {
  execFileSync("gh", args, { stdio: "inherit" });
}

let releaseExists = false;
try {
  execFileSync("gh", ["release", "view", tag], { stdio: "pipe" });
  releaseExists = true;
} catch {
  releaseExists = false;
}

if (!releaseExists) {
  gh([
    "release",
    "create",
    tag,
    "--draft",
    "--verify-tag",
    "--title",
    tag,
    "--notes",
    "",
  ]);
}

gh(["release", "upload", tag, ...paths, "--clobber"]);
console.log(
  `upload-github-release-assets: uploaded ${files.length} file(s) to GitHub ${tag}`,
);
