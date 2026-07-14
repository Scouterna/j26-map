import { cpSync, createReadStream, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Self-host the Tabler icons instead of fetching each one from unpkg at runtime
// (which cost a 302 redirect + a cross-origin request per icon). The icons ship
// in node_modules; we serve them from node_modules in dev and copy the whole set
// into dist/tabler on build, so getIconURL() can point at same-origin
// ./tabler/<variant>/<name>.svg. No import.meta.glob — that would bundle a ~1 MB
// index of all ~5000 icons into JS. See src/common/icons.ts.
function tablerIcons(): Plugin {
	const iconsDir = resolve(__dirname, "node_modules/@tabler/icons/icons");
	return {
		name: "tabler-icons",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const match = req.url?.match(
					/\/tabler\/(outline|filled)\/([a-z0-9-]+)\.svg(?:[?#]|$)/,
				);
				if (!match) return next();
				const file = resolve(iconsDir, match[1], `${match[2]}.svg`);
				if (!file.startsWith(iconsDir) || !existsSync(file)) return next();
				res.setHeader("Content-Type", "image/svg+xml");
				createReadStream(file).pipe(res);
			});
		},
		closeBundle() {
			cpSync(iconsDir, resolve(__dirname, "dist/tabler"), { recursive: true });
		},
	};
}

export default defineConfig({
	base: "/_services/map",
	envPrefix: ["VITE_", "J26_PUBLIC_"],
	plugins: [preact(), tailwindcss(), tablerIcons()],
	build: {
		rollupOptions: {
			input: {
				map: resolve(__dirname, "index.html"),
				preview: resolve(__dirname, "preview.html"),
				picker: resolve(__dirname, "picker.html"),
			},
		},
	},
	server: {
		allowedHosts: ["local.j26.se"],
	},
});
