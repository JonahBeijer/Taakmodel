import {defineConfig} from "vite";
import path, {dirname} from "path";
import {FileUrlToPath} from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    base: "./",
    root: path.resolve("client"),
    build: {
        outDir: "/docs",
        emptyOutDir: true
    }
});