import { DivIcon, LayerGroup, Marker, type PointTuple } from "leaflet";
import { useEffect, useState } from "preact/hooks";
import { useMap } from "../MapCanvas";

const SHOW_AT_ZOOM = 18;
const FADE_MS = 250;

type LabelFeature = {
	properties: { village_number: string };
	geometry: { type: "Point"; coordinates: [number, number] };
};

function createNumberIcon(number: string) {
	return new DivIcon({
		className: "",
		iconSize: [0, 0],
		iconAnchor: [0, 0],
		html: `<div style="
			position: absolute;
			top: 50%;
			left: 50%;
			font-size: 11px;
			font-weight: 600;
			color: #8a6a3a;
			white-space: nowrap;
			pointer-events: none;
			user-select: none;
			transform: translate(-50%, -50%);
		">${number}</div>`,
	});
}

export function VillageLabelsLayer() {
	const map = useMap();
	const [labels, setLabels] = useState<
		{ number: string; position: PointTuple }[]
	>([]);

	useEffect(() => {
		fetch("./layers/village_labels.geojson")
			.then((r) => r.json())
			.then((geojson: { features: LabelFeature[] }) => {
				setLabels(
					geojson.features.map((f) => ({
						number: f.properties.village_number,
						position: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
					})),
				);
			});
	}, []);

	useEffect(() => {
		if (!map || labels.length === 0) return;
		const mapRef = map;

		const pane = mapRef.createPane("villageLabelsPane");
		pane.style.zIndex = "325";
		pane.style.opacity = mapRef.getZoom() >= SHOW_AT_ZOOM ? "1" : "0";
		pane.style.transition = `opacity ${FADE_MS}ms`;

		const group = new LayerGroup(
			labels.map(
				({ number, position }) =>
					new Marker(position, {
						pane: "villageLabelsPane",
						icon: createNumberIcon(number),
						interactive: false,
					}),
			),
		);

		function updateOpacity() {
			pane.style.opacity = mapRef.getZoom() >= SHOW_AT_ZOOM ? "1" : "0";
		}

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
