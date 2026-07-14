// Content-hashed URLs for the map layer geojson files.
//
// The files live in src/map-layers/ and are pulled in through Vite's asset
// pipeline (import.meta.glob with `?url`), so each gets a content-hashed
// filename in the build (e.g. roads-a1b2c3.geojson). That makes a deploy bust
// CDN/browser caches automatically for exactly the files that changed — the
// stale-after-deploy problem you get when serving stable names from public/.
//
// `pnpm export-layers` writes the geojson straight into src/map-layers/.
const modules = import.meta.glob("../map-layers/*.geojson", {
	query: "?url",
	import: "default",
	eager: true,
}) as Record<string, string>;

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
	const name = path.slice(path.lastIndexOf("/") + 1, -".geojson".length);
	byName[name] = url;
}

/** Hashed URL for a map layer, e.g. `layerUrl("roads")`. */
export function layerUrl(name: string): string {
	const url = byName[name];
	if (!url) throw new Error(`Unknown map layer "${name}"`);
	return url;
}
