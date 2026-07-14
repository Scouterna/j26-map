#!/usr/bin/env node
// @ts-nocheck — plain Node build script: run via `node`, linted by Biome, and
// not part of the app's tsconfig (untyped geo libs, no type annotations).
/**
 * Export map layers from the J26 QGIS project straight into public/layers/.
 *
 * The QGIS project (Map.qgz) is the source of truth. This script reads the
 * layers inside one QGIS group (default: "Version 2"), resolves each layer's
 * data source — whether a sidecar .geojson or a filter against the DXF
 * GeoPackage — reprojects it to WGS84, and writes public/layers/<name>.geojson.
 *
 * Requirements (all present on the working WSL + Windows setup):
 *   - `unzip`            to read Map.qgs out of the .qgz zip container
 *   - Windows ogr2ogr.exe (ships with QGIS) for the actual conversion.
 *     No Linux GDAL is needed; we drive the Windows binary across WSL interop.
 *
 * Everything is overridable via env vars — see CONFIG below.
 *
 * Usage:
 *   pnpm export-layers                 # export the whole group
 *   pnpm export-layers villages tents  # export only named layers
 *   QGIS_GROUP="Version 3" pnpm export-layers
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import polylabel from "polylabel";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONFIG = {
	// .qgz project file (WSL-visible path, e.g. under /mnt/c/...).
	qgz: process.env.QGIS_QGZ ?? "/mnt/c/Users/Scrip/Documents/J26/Map/Map.qgz",
	// QGIS group whose layers get exported.
	group: process.env.QGIS_GROUP ?? "Version 2",
	// Windows ogr2ogr.exe (ships with QGIS). Update the version when QGIS updates.
	ogr2ogr:
		process.env.OGR2OGR ?? "/mnt/c/Program Files/QGIS 3.40.14/bin/ogr2ogr.exe",
	// Where exported files land (WSL path). src/map-layers so Vite content-hashes
	// them (cache-busting on deploy); see src/common/mapLayers.ts.
	outDir: process.env.OUT_DIR ?? resolve(repoRoot, "src/map-layers"),
	// Target CRS. WGS84 (lng/lat) is what MapLibre GL expects.
	targetSrs: "EPSG:4326",
	// Decimal places of degrees in output (7 ≈ 1cm; keeps files small).
	coordPrecision: "7",
	// Village "tile" look (see villageTiles override): each parcel is inset by
	// villageInsetMeters (the gap between tiles is ~2× this) and its corners are
	// rounded with villageCornerRadiusMeters.
	villageInsetMeters: 1.0,
	villageCornerRadiusMeters: 2.0,
	// Corner radius for the merged district blocks (village_blocks.geojson).
	villageBlockRoundMeters: 5.0,
};

// Per-layer tweaks the CAD/DXF source can't express on its own:
//  - geom: force an output geometry type (e.g. closed DXF lines → POLYGON so
//    MapLibre can fill them cleanly instead of mis-triangulating).
//  - meta: join branding (name/color) from a repo JSON file, keyed by `metaKey`
//    (a stable feature property). Replaces properties with just {name, color}.
//  - villageTiles: render parcels as the print map does — polygonize the closed
//    DXF lines, colour each by the district it sits in, and inset with rounded
//    corners so tiles read as separate rounded rectangles with padding.
const LAYER_OVERRIDES = {
	districts: {
		geom: "POLYGON",
		meta: "districts.meta.json",
		metaKey: "handle",
	},
	villages: {
		villageTiles: true,
	},
	village_labels: {
		villageLabels: true,
	},
	tents: {
		mergeTouching: true,
	},
};

const scriptDir = dirname(fileURLToPath(import.meta.url));

// Full (pre-inset) village polygons, cached by processVillageTiles so the
// village_labels step can centre each number on its parcel. villages is
// exported before village_labels in the group, so the cache is warm.
let fullVillagePolys = [];

// Only export these layer names (positional args); empty = whole group.
const onlyLayers = new Set(process.argv.slice(2));

/* ------------------------------------------------------------------ paths -- */

// /mnt/c/Users/x -> C:\Users\x   (what the Windows ogr2ogr.exe understands)
function mntToWin(p) {
	const m = /^\/mnt\/([a-z])\/(.*)$/.exec(p);
	if (!m) {
		throw new Error(
			`Expected a /mnt/<drive>/... path so it can be handed to the Windows ogr2ogr.exe, got: ${p}`,
		);
	}
	return `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, "\\")}`;
}

// /home/user/... -> \\wsl.localhost\<distro>\home\user\...  (so the Windows
// ogr2ogr.exe can write back into the WSL filesystem).
function wslToUnc(p) {
	const distro = process.env.WSL_DISTRO_NAME;
	if (!distro) {
		throw new Error(
			"WSL_DISTRO_NAME is not set — cannot build the UNC path the Windows ogr2ogr.exe writes to. Run this inside WSL.",
		);
	}
	return `\\\\wsl.localhost\\${distro}${p.replace(/\//g, "\\")}`;
}

/* -------------------------------------------------------------- qgs parse -- */

function decodeEntities(s) {
	return s
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
}

function attr(tag, name) {
	const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
	return m ? decodeEntities(m[1]) : null;
}

// Walk the <layer-tree> and return the layer-tree-layer nodes (name, source)
// that live inside the requested group. Groups can nest, so we track a stack.
function layersInGroup(qgs, groupName) {
	const token =
		/<layer-tree-group\b[^>]*?(\/?)>|<\/layer-tree-group>|<layer-tree-layer\b[^>]*?\/?>/g;
	const stack = [];
	const found = [];
	for (let m = token.exec(qgs); m !== null; m = token.exec(qgs)) {
		const text = m[0];
		if (text.startsWith("<layer-tree-group")) {
			// Self-closing (empty) group: no matching close tag, don't push.
			if (m[1] !== "/") stack.push(attr(text, "name"));
		} else if (text.startsWith("</layer-tree-group")) {
			stack.pop();
		} else {
			// layer-tree-layer
			if (stack.includes(groupName)) {
				found.push({
					name: attr(text, "name"),
					source: attr(text, "source"),
				});
			}
		}
	}
	return found;
}

/* --------------------------------------------------------- source resolve -- */

// A QGIS OGR source is either a plain path ("./x.geojson") or a GeoPackage
// with layer/subset pipes ("./x.gpkg|layername=polylines|subset=layer IN (...)").
function parseSource(source, qgzDirMnt) {
	const parts = source.split("|");
	const relPath = parts[0];
	const opts = {};
	for (const part of parts.slice(1)) {
		const eq = part.indexOf("=");
		if (eq !== -1) opts[part.slice(0, eq)] = part.slice(eq + 1);
	}
	// QGIS relative paths are relative to the .qgz directory.
	const mnt = relPath.startsWith(".") ? resolve(qgzDirMnt, relPath) : relPath;
	return { mnt, win: mntToWin(mnt), table: opts.layername, where: opts.subset };
}

/* --------------------------------------------------------------- exporter -- */

function featureCount(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8")).features?.length ?? "?";
	} catch {
		return "?";
	}
}

// Replace each feature's properties with {name, color} from a repo metadata
// file, matched on a stable property. Returns keys that had no metadata entry.
function applyMeta(outMnt, override) {
	const metaPath = resolve(scriptDir, override.meta);
	const byKey = JSON.parse(readFileSync(metaPath, "utf8")).byHandle;
	const fc = JSON.parse(readFileSync(outMnt, "utf8"));
	const unmatched = [];
	for (const f of fc.features) {
		const key = String(f.properties?.[override.metaKey]);
		const m = byKey[key];
		if (m) f.properties = { name: m.name, color: m.color };
		else {
			f.properties = { name: null, color: null };
			unmatched.push(key);
		}
	}
	writeFileSync(outMnt, JSON.stringify(fc));
	return unmatched;
}

// Turn the exported parcels into print-map "tiles": polygonize the closed DXF
// lines, colour each by the district it falls in, and inset with rounded corners
// so adjacent parcels read as separate padded tiles. Needs districts.geojson
// (already exported earlier in the group) for the colour join.
function processVillageTiles(outMnt) {
	const fc = JSON.parse(readFileSync(outMnt, "utf8"));
	const districtsPath = resolve(CONFIG.outDir, "districts.geojson");
	const districts = existsSync(districtsPath)
		? JSON.parse(readFileSync(districtsPath, "utf8")).features
		: [];
	const inset = CONFIG.villageInsetMeters / 1000; // km, for turf
	const radius = CONFIG.villageCornerRadiusMeters / 1000; // km

	const hasGeom = (g) => g?.geometry?.coordinates?.length;
	// Inset a parcel by `inset` AND round its (convex) corners by `radius`.
	// A plain negative buffer only rounds concave corners, so convex corners of
	// rectangular parcels stay sharp — hence the shrink-past-then-grow-back trick:
	// erode by (inset+radius), then dilate by radius with round joins.
	const roundedInset = (poly) => {
		const eroded = turf.buffer(poly, -(inset + radius), {
			units: "kilometers",
			steps: 8,
		});
		if (hasGeom(eroded)) {
			const grown = turf.buffer(eroded, radius, {
				units: "kilometers",
				steps: 8,
			});
			if (hasGeom(grown)) return grown.geometry;
		}
		// Parcel too small for the full radius: fall back to a plain inset.
		const flat = turf.buffer(poly, -inset, { units: "kilometers", steps: 8 });
		return hasGeom(flat) ? flat.geometry : poly.geometry;
	};

	let uncoloured = 0;
	let dropped = 0;
	const features = [];
	const byDistrict = new Map(); // district -> { color, polys[] }, for merged blocks
	fullVillagePolys = []; // cache full polys for the village_labels centring step
	for (const f of fc.features) {
		let poly;
		try {
			poly = f.geometry?.type === "LineString" ? turf.lineToPolygon(f) : f;
		} catch {
			dropped++; // degenerate CAD entity (e.g. a zero-length line) — skip it
			continue;
		}
		const ring = poly.geometry?.coordinates?.[0];
		if (!Array.isArray(ring) || ring.length < 4) {
			dropped++;
			continue;
		}
		fullVillagePolys.push(poly);

		let color = null;
		let district = null;
		try {
			const c = turf.centroid(poly);
			for (const d of districts) {
				if (turf.booleanPointInPolygon(c, d)) {
					color = d.properties.color;
					district = d.properties.name;
					break;
				}
			}
		} catch {}
		if (!color) uncoloured++;
		if (district) {
			const g = byDistrict.get(district) ?? { color, polys: [] };
			g.polys.push(poly);
			byDistrict.set(district, g);
		}

		let geom = poly.geometry;
		try {
			geom = roundedInset(poly);
		} catch {}

		features.push({
			type: "Feature",
			properties: { color, district },
			geometry: geom,
		});
	}

	writeFileSync(
		outMnt,
		JSON.stringify({ type: "FeatureCollection", name: "villages", features }),
	);

	// Merged blocks (village_blocks.geojson): dissolve each district's parcels
	// into one solid block for the zoomed-out view, hiding the inter-tile padding.
	// A small +/- buffer closes the hairline gaps between adjacent CAD parcels
	// (roads stay as gaps), an opening rounds the outer corners, and a final inset
	// by villageInsetMeters keeps the same padding as the tiles.
	const gap = 0.0005; // km (0.5m)
	const br = CONFIG.villageBlockRoundMeters / 1000; // km
	// Opening (erode br, dilate br): rounds convex corners with radius br and never
	// connects separate parts — so a larger radius does NOT merge villages across
	// roads. (A close pass would round concave corners too, but its dilation fills
	// gaps < ~2·br, merging clusters — hence opening only.)
	const smoothBlock = (f) => {
		const a = turf.buffer(f, -br, { units: "kilometers", steps: 8 });
		if (!hasGeom(a)) return f;
		const b = turf.buffer(a, br, { units: "kilometers", steps: 8 });
		return hasGeom(b) ? b : f;
	};
	const blocks = [];
	for (const [district, { color, polys }] of byDistrict) {
		try {
			const grown = polys.map((p) =>
				turf.buffer(p, gap, { units: "kilometers", steps: 8 }),
			);
			let u =
				grown.length === 1
					? grown[0]
					: turf.union(turf.featureCollection(grown));
			u = turf.buffer(u, -gap, { units: "kilometers", steps: 8 });
			u = smoothBlock(u);
			u = turf.buffer(u, -inset, { units: "kilometers", steps: 8 });
			if (hasGeom(u)) {
				blocks.push({
					type: "Feature",
					properties: { color, district },
					geometry: u.geometry,
				});
			}
		} catch {}
	}
	writeFileSync(
		resolve(CONFIG.outDir, "village_blocks.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			name: "village_blocks",
			features: blocks,
		}),
	);

	const notes = [`merged ${blocks.length} district block(s) → village_blocks`];
	if (districts.length === 0)
		notes.push("districts.geojson missing — parcels left uncoloured");
	else if (uncoloured > 0)
		notes.push(
			`${uncoloured} parcel(s) fell outside every district (uncoloured)`,
		);
	if (dropped > 0) notes.push(`${dropped} degenerate parcel(s) dropped`);
	return notes.length > 0 ? notes.join("; ") : undefined;
}

// Best spot to drop a number on a parcel:
//  - the centroid when it sits comfortably inside — visually centred, which is
//    what you want for the common rectangular parcels (the pole of
//    inaccessibility can drift to one end of an elongated shape);
//  - otherwise the pole of inaccessibility, which stays inside concave parcels
//    whose centroid would fall in a gap.
// polylabel is run in lng*cos(lat) space so it isn't skewed by a longitude
// degree being shorter than a latitude degree at this latitude.
function labelPoint(poly) {
	const c = turf.centroid(poly).geometry.coordinates;
	const line = turf.polygonToLine(poly);
	const edgeDist = (p) =>
		turf.pointToLineDistance(p, line, { units: "meters" });

	const k = Math.cos((c[1] * Math.PI) / 180);
	const scaled = poly.geometry.coordinates.map((r) =>
		r.map(([x, y]) => [x * k, y]),
	);
	const pl = polylabel(scaled, 1e-7);
	const pole = [pl[0] / k, pl[1]];

	// Prefer the centroid unless the pole is clearly deeper inside (concave case).
	if (
		turf.booleanPointInPolygon(c, poly) &&
		edgeDist(c) >= 0.6 * edgeDist(pole)
	) {
		return c;
	}
	return pole;
}

// Village labels: (1) pull a bare `village_number` out of the DXF address text
// ("Östersjön 351\PAllemansavenyn" → "351"), and (2) move the label from the CAD
// text anchor to a well-centred point inside the parcel it sits in (see
// labelPoint). Matches against the full (pre-inset) village polygons.
function processVillageLabels(outMnt) {
	const fc = JSON.parse(readFileSync(outMnt, "utf8"));
	let polys = fullVillagePolys;
	if (polys.length === 0) {
		// Labels exported on their own — fall back to the villages file on disk.
		const vp = resolve(CONFIG.outDir, "villages.geojson");
		if (existsSync(vp)) polys = JSON.parse(readFileSync(vp, "utf8")).features;
	}

	let missing = 0;
	let centred = 0;
	for (const f of fc.features) {
		const num = (f.properties?.text ?? "").split(/\\P/)[0].match(/(\d+)/)?.[1];
		if (!num) missing++;

		try {
			const pt = turf.point(f.geometry.coordinates);
			for (const poly of polys) {
				if (turf.booleanPointInPolygon(pt, poly)) {
					const [lng, lat] = labelPoint(poly);
					f.geometry = {
						type: "Point",
						coordinates: [+lng.toFixed(7), +lat.toFixed(7)],
					};
					centred++;
					break;
				}
			}
		} catch {}

		f.properties = { village_number: num ?? null };
	}

	writeFileSync(outMnt, JSON.stringify(fc));
	const notes = [];
	if (missing > 0)
		notes.push(`${missing} label(s) had no number in their text`);
	notes.push(`centred ${centred}/${fc.features.length} on parcels`);
	return notes.join("; ");
}

// Dissolve touching polygons into one shape: polygonise, close hairline CAD
// seams with a small +/- buffer, union, then split back into one feature per
// connected blob. Used for tents so adjacent tents read as a single polygon.
function mergeTouchingPolys(outMnt, name) {
	const fc = JSON.parse(readFileSync(outMnt, "utf8"));
	const gap = 0.0002; // km (0.2m) — closes hairline seams, not real gaps
	const polys = [];
	let dropped = 0;
	for (const f of fc.features) {
		let poly;
		try {
			poly = f.geometry?.type === "LineString" ? turf.lineToPolygon(f) : f;
		} catch {
			dropped++;
			continue;
		}
		const ring = poly.geometry?.coordinates?.[0];
		if (!Array.isArray(ring) || ring.length < 4) {
			dropped++;
			continue;
		}
		polys.push(turf.buffer(poly, gap, { units: "kilometers", steps: 4 }));
	}
	let u =
		polys.length === 1 ? polys[0] : turf.union(turf.featureCollection(polys));
	u = turf.buffer(u, -gap, { units: "kilometers", steps: 4 });
	const features = turf.flatten(u).features.map((f) => ({
		type: "Feature",
		properties: {},
		geometry: f.geometry,
	}));
	writeFileSync(
		outMnt,
		JSON.stringify({ type: "FeatureCollection", name, features }),
	);
	const notes = [`merged ${polys.length} → ${features.length} polygon(s)`];
	if (dropped > 0) notes.push(`${dropped} degenerate dropped`);
	return notes.join("; ");
}

function exportLayer(layer, qgzDirMnt) {
	const override = LAYER_OVERRIDES[layer.name] ?? {};
	const src = parseSource(layer.source, qgzDirMnt);
	if (!existsSync(src.mnt)) {
		return { ...layer, ok: false, error: `source not found: ${src.mnt}` };
	}

	const outMnt = resolve(CONFIG.outDir, `${layer.name}.geojson`);
	rmSync(outMnt, { force: true }); // ogr2ogr won't overwrite a GeoJSON file

	const args = [
		"-f",
		"GeoJSON",
		"-t_srs",
		CONFIG.targetSrs,
		"-lco",
		`COORDINATE_PRECISION=${CONFIG.coordPrecision}`,
		"-nln",
		layer.name,
	];
	if (override.geom) args.push("-nlt", override.geom);
	if (src.where) args.push("-where", src.where);
	args.push(wslToUnc(outMnt), src.win);
	if (src.table) args.push(src.table);

	const res = spawnSync(CONFIG.ogr2ogr, args, { encoding: "utf8" });
	if (res.status !== 0) {
		return {
			...layer,
			ok: false,
			error: (res.stderr || res.error?.message || "ogr2ogr failed").trim(),
		};
	}

	let warning;
	if (override.meta) {
		const unmatched = applyMeta(outMnt, override);
		if (unmatched.length > 0) {
			warning = `no ${override.meta} entry for ${override.metaKey}=${unmatched.join(", ")}`;
		}
	}
	if (override.villageTiles) {
		warning = processVillageTiles(outMnt);
	}
	if (override.villageLabels) {
		warning = processVillageLabels(outMnt);
	}
	if (override.mergeTouching) {
		warning = mergeTouchingPolys(outMnt, layer.name);
	}

	return {
		...layer,
		ok: true,
		count: featureCount(outMnt),
		out: outMnt,
		warning,
	};
}

/* ------------------------------------------------------------------- main -- */

function main() {
	if (!existsSync(CONFIG.qgz)) {
		console.error(`QGIS project not found: ${CONFIG.qgz}`);
		console.error("Set QGIS_QGZ to its path (a /mnt/... path under WSL).");
		process.exit(1);
	}
	if (!existsSync(CONFIG.ogr2ogr)) {
		console.error(`ogr2ogr.exe not found: ${CONFIG.ogr2ogr}`);
		console.error("Set OGR2OGR to your QGIS install's bin/ogr2ogr.exe.");
		process.exit(1);
	}

	const qgzDirMnt = dirname(CONFIG.qgz);
	// Map.qgz is a zip; the project XML lives inside as Map.qgs.
	const qgs = execFileSync("unzip", ["-p", CONFIG.qgz, "Map.qgs"], {
		encoding: "utf8",
		maxBuffer: 256 * 1024 * 1024,
	});

	let layers = layersInGroup(qgs, CONFIG.group);
	if (layers.length === 0) {
		console.error(`No layers found in QGIS group "${CONFIG.group}".`);
		process.exit(1);
	}
	if (onlyLayers.size > 0) {
		layers = layers.filter((l) => onlyLayers.has(l.name));
	}

	// Full export: QGIS is the source of truth, so wipe any stale .geojson first.
	// A named-subset run leaves the rest of the directory alone.
	if (onlyLayers.size === 0) {
		const stale = readdirSync(CONFIG.outDir).filter((f) =>
			f.endsWith(".geojson"),
		);
		for (const f of stale) rmSync(resolve(CONFIG.outDir, f), { force: true });
		if (stale.length > 0) {
			console.log(`Cleared ${stale.length} existing .geojson file(s).`);
		}
	}

	console.log(
		`Exporting ${layers.length} layer(s) from group "${CONFIG.group}" → ${CONFIG.outDir}\n`,
	);

	const results = layers.map((l) => exportLayer(l, qgzDirMnt));

	for (const r of results) {
		if (r.ok) {
			console.log(`  ✓ ${r.name.padEnd(22)} ${r.count} features`);
			if (r.warning) console.log(`    ⚠ ${r.warning}`);
		} else {
			console.log(`  ✗ ${r.name.padEnd(22)} ${r.error}`);
		}
	}

	const failed = results.filter((r) => !r.ok);
	console.log(
		`\nDone: ${results.length - failed.length} ok, ${failed.length} failed.`,
	);
	if (failed.length > 0) process.exit(1);
}

main();
