#!/usr/bin/env node
/**
 * After electron-builder publishes to GitHub, mirror the same artifacts from release/
 * to Cloudflare R2 (S3 API). Idempotent overwrites.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RELEASE_DIR = path.join(ROOT, "release");

/** Must match R2 key prefix (see scripts/rewrite-r2-update-metadata.mjs). */
const PATH_PREFIX = "apple-key-rotation";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const bucket = process.env.CLOUDFLARE_R2_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

function contentType(name) {
  if (name.endsWith(".yml") || name.endsWith(".yaml")) return "application/x-yaml";
  if (name.endsWith(".dmg")) return "application/x-apple-diskimage";
  if (name.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

async function main() {
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    console.log(
      "sync-release-to-r2: skip (set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY to mirror)",
    );
    return;
  }

  if (!fs.existsSync(RELEASE_DIR)) {
    console.error("sync-release-to-r2: release/ not found");
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const names = fs.readdirSync(RELEASE_DIR);
  const files = names.filter((n) => {
    const p = path.join(RELEASE_DIR, n);
    if (!fs.statSync(p).isFile()) return false;
    if (n.startsWith("builder-") || n.includes("effective-config")) return false;
    if (n === "latest-mac.yml") return true;
    if (n.endsWith(".dmg") || n.endsWith(".zip")) return true;
    if (n.endsWith(".blockmap")) return true;
    return false;
  });

  if (files.length === 0) {
    console.error("sync-release-to-r2: no DMG/ZIP/blockmap/latest-mac.yml in release/");
    process.exit(1);
  }

  for (const name of files) {
    const filePath = path.join(RELEASE_DIR, name);
    const key = `${PATH_PREFIX}/${name}`;
    const body = fs.readFileSync(filePath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType(name),
      }),
    );
    console.log(`sync-release-to-r2: uploaded ${key}`);
  }

  console.log(`sync-release-to-r2: done (${files.length} file(s))`);
}

await main();
