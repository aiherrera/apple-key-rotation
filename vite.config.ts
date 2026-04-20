import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build as esbuildBuild, buildSync as esbuildBuildSync } from "esbuild";
import { defineConfig, type Plugin } from "vite";
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

const PRELOAD_SOURCE = path.join(__dirname, "electron/preload.ts");
const PRELOAD_OUTFILE = path.join(__dirname, "dist-electron/preload.cjs");

/** Single-writer CJS preload. vite-plugin-electron ran two parallel preload builds and corrupted preload.cjs. */
function buildPreloadBundleSync(): void {
  esbuildBuildSync({
    absWorkingDir: __dirname,
    entryPoints: [PRELOAD_SOURCE],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: PRELOAD_OUTFILE,
    external: ["electron"],
    legalComments: "none",
    logLevel: "silent",
  });
}

function electronPreloadEsbuildPlugin(): Plugin {
  return {
    name: "electron-preload-esbuild",
    apply: "serve",
    configureServer(server) {
      if (!isElectron) return;
      server.httpServer?.once("listening", () => {
        buildPreloadBundleSync();
      });
      server.watcher.on("change", (file) => {
        if (path.normalize(file) === path.normalize(PRELOAD_SOURCE)) {
          buildPreloadBundleSync();
        }
      });
    },
  };
}

function electronPreloadEsbuildBuildPlugin(): Plugin {
  return {
    name: "electron-preload-esbuild-build",
    apply: "build",
    enforce: "pre",
    async closeBundle() {
      if (!isElectron) return;
      await esbuildBuild({
        absWorkingDir: __dirname,
        entryPoints: [PRELOAD_SOURCE],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: PRELOAD_OUTFILE,
        external: ["electron"],
        legalComments: "none",
        logLevel: "silent",
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
    ...(mode === "development" ? [componentTagger()] : []),
  ];

  if (isElectron) {
    plugins.push(
      electronPreloadEsbuildPlugin(),
      electronPreloadEsbuildBuildPlugin(),
      electron([
        {
          entry: "electron/main.ts",
          vite: {
            build: {
              rollupOptions: {
                external: ["electron", "better-sqlite3", "electron-updater"],
              },
            },
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
