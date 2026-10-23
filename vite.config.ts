import { defineConfig } from "vite";
import { execSync } from "node:child_process";
const buildId =
  process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString().trim();
export default defineConfig({
  base: "./",
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    {
      name: "build-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ buildId }),
        });
      },
    },
  ],
});
