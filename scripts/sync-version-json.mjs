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
