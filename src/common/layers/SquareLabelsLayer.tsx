import maplibregl from "maplibre-gl";
import { useEffect, useState } from "preact/hooks";
import type { PointTuple } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { layerUrl } from "../mapLayers";

type SquareFeature = {
	properties: { name: string };
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

function createLabelElement(name: string): HTMLElement {
	const el = document.createElement("div");
	el.style.cssText = `
		font-size: calc(15px * pow(2, (min(var(--map-zoom-anim), 18) - 17) * 0.4));
		font-weight: 700;
		color: #15375c;
		text-shadow: 0 1px 2px rgba(255, 255, 255, 0.6);
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
		z-index: 400;
	`;
	el.textContent = name;
	return el;
}

export function SquareLabelsLayer() {
	const map = useMap();
	const [labels, setLabels] = useState<
		{ name: string; position: PointTuple }[]
	>([]);

	useEffect(() => {
		fetch(layerUrl("squares"))
			.then((r) => r.json())
			.then((geojson: { features: SquareFeature[] }) => {
				setLabels(
					geojson.features.map((f) => ({
						name: f.properties.name,
						position: centroid(f.geometry.coordinates[0]),
					})),
				);
			});
	}, []);

	useEffect(() => {
		if (!map || labels.length === 0) return;

		const markers = labels.map(({ name, position }) => {
			// Inner element carries any zoom-scaling CSS; MapLibre's _updateOpacity
			// sets opacity on the outer wrapper only, so inner styles are preserved.
			const inner = createLabelElement(name);
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
