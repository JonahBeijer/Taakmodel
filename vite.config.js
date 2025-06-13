import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    base: "./",
    root: path.resolve(__dirname, "client"),
    build: {
        outDir: "docs", // zonder slash!
        emptyOutDir: true
    }
});
