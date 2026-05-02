import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8"));
const out = {
  version: pkg.version,
  name: pkg.name,
  productName: pkg.build?.productName ?? pkg.name,
};
writeFileSync(
  path.join(root, "public", "version.json"),
  `${JSON.stringify(out, null, 2)}\n`,
  "utf-8",
);

const releasePath = path.join(root, "src", "constants", "releaseHistory.ts");
const releaseSrc = readFileSync(releasePath, "utf-8");
const relIdx = releaseSrc.indexOf("export const RELEASE_HISTORY");
if (relIdx === -1) {
  console.error("[version:sync] Could not find RELEASE_HISTORY in", releasePath);
  process.exit(1);
}
const firstVersion = releaseSrc.slice(relIdx).match(/version:\s*"([^"]+)"/);
if (!firstVersion) {
  console.error("[version:sync] Could not read first version in", releasePath);
  process.exit(1);
}
if (firstVersion[1] !== pkg.version) {
  console.error(
    `[version:sync] Changelog: newest entry is v${firstVersion[1]} but package.json is v${pkg.version}. ` +
      `Add a ${pkg.version} block at the top of RELEASE_HISTORY in src/constants/releaseHistory.ts (newest first).`,
  );
  process.exit(1);
}
console.log(
  "[version:sync] OK: public/version.json and changelog head both at v" + pkg.version,
);
