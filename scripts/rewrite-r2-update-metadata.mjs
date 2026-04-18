#!/usr/bin/env node
/**
 * After electron-builder publishes to R2, artifact URLs in latest-mac.yml may use the
 * S3 API host (not anonymously readable). If R2_PUBLIC_BASE_URL is set, rewrite YAML
 * files under release/ and re-upload them to the same R2 prefix.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RELEASE_DIR = path.join(ROOT, "release");

const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const bucket = process.env.CLOUDFLARE_R2_BUCKET;
const pathPrefix = "apple-key-rotation";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!publicBase) {
  process.exit(0);
}

if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "rewrite-r2-update-metadata: R2_PUBLIC_BASE_URL is set but CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY is missing."
  );
  process.exit(1);
}

const internalBase = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${pathPrefix}`;

function normalizeUrl(u) {
  return u.replace(/\/$/, "");
}

const from = normalizeUrl(internalBase);
const to = normalizeUrl(publicBase);

if (from === to) {
  process.exit(0);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

async function main() {
  if (!fs.existsSync(RELEASE_DIR)) {
    console.error("rewrite-r2-update-metadata: release/ not found");
    process.exit(1);
  }

  const names = fs.readdirSync(RELEASE_DIR);
  const ymlFiles = names.filter(
    (n) => n.endsWith(".yml") || n.endsWith(".yaml")
  );

  let touched = 0;
  for (const name of ymlFiles) {
    const filePath = path.join(RELEASE_DIR, name);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    let text = fs.readFileSync(filePath, "utf8");
    if (!text.includes(from)) continue;

    text = text.split(from).join(to);
    fs.writeFileSync(filePath, text, "utf8");

    const key = `${pathPrefix}/${name}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.readFileSync(filePath),
        ContentType: name.endsWith(".yaml")
          ? "application/yaml"
          : "application/x-yaml",
      })
    );
    touched += 1;
    console.log(`rewrite-r2-update-metadata: patched and re-uploaded ${key}`);
  }

  if (touched === 0) {
    console.warn(
      "rewrite-r2-update-metadata: no YAML contained the internal base URL; check CLOUDFLARE_ACCOUNT_ID / bucket / path"
    );
  }
}

await main();
