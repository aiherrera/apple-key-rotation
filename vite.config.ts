import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "package.json"), "utf-8"),
) as { version: string };

const isElectron = process.env.ELECTRON === "true";

const envDefine: Record<string, string> = {
  "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
};
if (isElectron) {
  envDefine["import.meta.env.VITE_ELECTRON"] = JSON.stringify("true");
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
    ...(mode === "development" ? [componentTagger()] : []),
  ];

  if (isElectron) {
    plugins.push(
      electron([
        {
          entry: "electron/main.ts",
        },
        {
          entry: "electron/preload.ts",
          onstart(args) {
            args.reload();
          },
        },
      ]),
      renderer(),
    );
  }

  return {
    base: isElectron ? "./" : "/",
    define: envDefine,
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
