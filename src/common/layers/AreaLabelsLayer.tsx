import maplibregl from "maplibre-gl";
import { useEffect, useState } from "preact/hooks";
import type { PointTuple } from "../locationTypes";
import { useMap } from "../MapCanvas";

type DistrictFeature = {
	properties: { name: string; color?: string };
	geometry: { type: "Polygon"; coordinates: number[][][] };
};

function centroid(coords: number[][]): PointTuple {
	let area = 0;
	let cx = 0;
	let cy = 0;
	const n = coords.length;
	for (let i = 0; i < n; i++) {
		const [x0, y0] = coords[i];
		const [x1, y1] = coords[(i + 1) % n];
		const cross = x0 * y1 - x1 * y0;
		area += cross;
		cx += (x0 + x1) * cross;
		cy += (y0 + y1) * cross;
	}
	area /= 2;
	if (Math.abs(area) < 1e-12) {
		const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
		const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
		return [lat, lng];
	}
	cx /= 6 * area;
	cy /= 6 * area;
	return [cy, cx]; // [lat, lng]
}

function createLabelElement(name: string, color = "#3d5a3e"): HTMLElement {
	const el = document.createElement("div");
	// j26-zoom-hide-18 class (style.css) provides zoom-based opacity via --map-zoom-anim.
	// This element is the INNER content; the outer wrapper is what MapLibre controls (opacity always 1).
	el.className = "j26-zoom-hide-16";
	el.style.cssText = `
		font-size: calc(18px * pow(2, (min(var(--map-zoom-anim), 17) - 16) * 0.4));
		font-weight: 600;
		color: ${color};
		text-shadow: 0 0 3px #cdebb0, 0 0 6px #cdebb0;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
		z-index: 450;
	`;
	el.textContent = name;
	return el;
}

export function AreaLabelsLayer() {
	const map = useMap();
	const [labels, setLabels] = useState<
		{ name: string; color?: string; position: PointTuple }[]
	>([]);

	useEffect(() => {
		fetch("./layers/districts.geojson")
			.then((r) => r.json())
			.then((geojson: { features: DistrictFeature[] }) => {
				setLabels(
					geojson.features.map((f) => ({
						name: f.properties.name,
						color: f.properties.color,
						position: centroid(f.geometry.coordinates[0]),
					})),
				);
			});
	}, []);

	useEffect(() => {
		if (!map || labels.length === 0) return;

		const markers = labels.map(({ name, color, position }) => {
			// Inner element carries the zoom class; MapLibre's _updateOpacity sets opacity on the
			// outer wrapper only, so the inner zoom-class opacity is not overridden.
			const inner = createLabelElement(name, color);
			const outer = document.createElement("div");
			outer.style.cssText = "display:inline-block;pointer-events:none";
			outer.appendChild(inner);
			return new maplibregl.Marker({ element: outer, anchor: "center" })
				.setLngLat([position[1], position[0]])
				.addTo(map);
		});

		return () => {
			for (const m of markers) m.remove();
		};
	}, [map, labels]);

	return null;
}
