import { DivIcon, LayerGroup, Marker, type PointTuple } from "leaflet";
import { useEffect, useState } from "preact/hooks";
import { useMap } from "../MapCanvas";

const HIDE_AT_ZOOM = 18;
const FADE_MS = 250;

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

function createLabelIcon(name: string, color = "#3d5a3e") {
	return new DivIcon({
		className: "",
		iconSize: [0, 0],
		iconAnchor: [0, 0],
		html: `<div style="
			position: absolute;
			top: 50%;
			left: 50%;
			font-size: calc(18px * pow(2, (min(var(--map-zoom), 17) - 16) * 0.4));
			font-weight: 600;
			color: ${color};
			text-shadow: 0 0 3px #cdebb0, 0 0 6px #cdebb0;
			white-space: nowrap;
			pointer-events: none;
			user-select: none;
			transform: translate(-50%, -50%);
		">${name}</div>`,
	});
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
		const mapRef = map;

		const pane = mapRef.createPane("areaLabelsPane");
		pane.style.zIndex = "450";
		pane.style.opacity = "1";
		pane.style.transition = `opacity ${FADE_MS}ms`;

		const group = new LayerGroup(
			labels.map(
				({ name, color, position }) =>
					new Marker(position, {
						pane: "areaLabelsPane",
						icon: createLabelIcon(name, color),
						interactive: false,
					}),
			),
		);

		function updateOpacity() {
			pane.style.opacity = mapRef.getZoom() >= HIDE_AT_ZOOM ? "0" : "1";
		}

		updateOpacity();
		mapRef.on("zoomend", updateOpacity);
		mapRef.addLayer(group);

		return () => {
			mapRef.off("zoomend", updateOpacity);
			mapRef.removeLayer(group);
			pane.remove();
		};
	}, [map, labels]);

	return null;
}
