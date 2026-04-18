#!/usr/bin/env node
/**
 * After electron-builder publishes to R2, update metadata may need public URLs:
 * - electron-builder often writes **relative** `url:` / `path:` values (basename only) in
 *   latest-mac.yml; clients resolve them against the feed URL, but a public custom domain
 *   still needs consistent absolute links for browsers / some updater paths.
 * - If the YAML already contains full S3 API URLs (`*.r2.cloudflarestorage.com`), those are
 *   rewritten to R2_PUBLIC_BASE_URL when possible.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RELEASE_DIR = path.join(ROOT, "release");

/** Must match `build.publish[].path` (s3 entry) in package.json. */
const PATH_PREFIX = "apple-key-rotation";

const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const bucket = process.env.CLOUDFLARE_R2_BUCKET;
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

const internalBase = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${PATH_PREFIX}`;

function normalizeUrl(u) {
  return u.replace(/\/$/, "");
}

const from = normalizeUrl(internalBase);
const to = normalizeUrl(publicBase);

/**
 * Prefix relative `url:` / `path:` values with the public base (electron-builder mac YAML).
 */
function expandRelativeUrls(text, base) {
  const stripQuotes = (v) => v.trim().replace(/^["']|["']$/g, "");

  return text.replace(
    /^([ \t]*(?:-\s+)?url:[ \t]+)([^\n]+)$/gim,
    (line, prefix, rawVal) => {
      const val = stripQuotes(rawVal);
      if (/^https?:\/\//i.test(val)) {
        return line;
      }
      if (!val || val === "|" || val === ">") {
        return line;
      }
      const full = `${base}/${encodeURI(val)}`;
      return `${prefix}${full}`;
    }
  ).replace(
    /^([ \t]*path:[ \t]+)([^\n]+)$/gim,
    (line, prefix, rawVal) => {
      const val = stripQuotes(rawVal);
      if (/^https?:\/\//i.test(val)) {
        return line;
      }
      if (!val || val === "|" || val === ">") {
        return line;
      }
      const full = `${base}/${encodeURI(val)}`;
      return `${prefix}${full}`;
    }
  );
}

function rewriteYaml(text) {
  let out = text;
  if (from !== to && out.includes(from)) {
    out = out.split(from).join(to);
  }
  out = expandRelativeUrls(out, to);
  return out;
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
  const ymlFiles = names.filter((n) => {
    if (!n.endsWith(".yml") && !n.endsWith(".yaml")) return false;
    if (n.startsWith("builder-") || n.includes("effective-config")) {
      return false;
    }
    return true;
  });

  let touched = 0;
  for (const name of ymlFiles) {
    const filePath = path.join(RELEASE_DIR, name);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const original = fs.readFileSync(filePath, "utf8");
    const next = rewriteYaml(original);
    if (next === original) {
      continue;
    }

    fs.writeFileSync(filePath, next, "utf8");

    const key = `${PATH_PREFIX}/${name}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(next, "utf8"),
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
      "rewrite-r2-update-metadata: no YAML needed changes (already public URLs or no url/path lines?)"
    );
  }
}

await main();
