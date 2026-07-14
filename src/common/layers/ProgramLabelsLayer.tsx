import maplibregl from "maplibre-gl";
import { useEffect, useState } from "preact/hooks";
import type { PointTuple } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { layerUrl } from "../mapLayers";

type ProgramFeature = {
	properties: { name: string };
	geometry: { type: "LineString"; coordinates: number[][] };
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

// A blue name plate matching the district labels (see AreaLabelsLayer), but with
// a small "Program" kicker line above the area name.
function createLabelElement(name: string): HTMLElement {
	const el = document.createElement("div");
	el.style.cssText = `
		font-size: calc(18px * pow(2, (min(var(--map-zoom-anim), 17) - 16) * 0.4));
		font-weight: 600;
		color: #fafcd9;
		background: #15375c;
		padding: 0.4em 0.9em;
		border-radius: 0.5em;
		text-align: center;
		line-height: 1.15;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
		z-index: 450;
	`;

	const kicker = document.createElement("div");
	kicker.style.cssText = `
		font-size: 0.6em;
		font-weight: 700;
		letter-spacing: 0.08em;
		opacity: 0.8;
	`;
	kicker.textContent = "Program";

	const title = document.createElement("div");
	title.textContent = name;

	el.appendChild(kicker);
	el.appendChild(title);
	return el;
}

export function ProgramLabelsLayer() {
	const map = useMap();
	const [labels, setLabels] = useState<
		{ name: string; position: PointTuple }[]
	>([]);

	useEffect(() => {
		fetch(layerUrl("program"))
			.then((r) => r.json())
			.then((geojson: { features: ProgramFeature[] }) => {
				setLabels(
					geojson.features.map((f) => ({
						name: f.properties.name,
						position: centroid(f.geometry.coordinates),
					})),
				);
			});
	}, []);

	useEffect(() => {
		if (!map || labels.length === 0) return;

		const markers = labels.map(({ name, position }) =>
			new maplibregl.Marker({
				element: createLabelElement(name),
				anchor: "center",
			})
				.setLngLat([position[1], position[0]])
				.addTo(map),
		);

		return () => {
			for (const m of markers) m.remove();
		};
	}, [map, labels]);

	return null;
}
