import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Single-file embed build for dropping into Google Sites etc.
// Curated /data/* JSON and CSV files are NOT inlined — the embed build
// falls back to "show the curated number only" mode when a runtime
// fetch fails (e.g. when opened from file:// or embedded somewhere
// that can't reach Firebase Hosting).
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    target: "es2022",
    outDir: "dist-embed",
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
