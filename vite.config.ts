import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	base: "./",
	plugins: [preact(), tailwindcss()],
	build: {
		rollupOptions: {
			input: {
				map: resolve(__dirname, "index.html"),
				preview: resolve(__dirname, "preview.html"),
				picker: resolve(__dirname, "picker.html"),
			},
		},
	},
});
