import { DivIcon, LayerGroup, Marker, type PointTuple } from "leaflet";
import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

const HIDE_AT_ZOOM = 18;
const FADE_MS = 250;

type AreaLabel = {
	name: string;
	position: PointTuple;
};

const AREA_LABELS: AreaLabel[] = [
	{ name: "Hjärtat", position: [55.979357, 14.134038] },
];

function createLabelIcon(name: string) {
	return new DivIcon({
		className: "",
		iconSize: [0, 0],
		iconAnchor: [0, 0],
		html: `<div style="
			position: absolute;
			top: 50%;
			left: 50%;
			font-size: calc(14px * pow(2, min(var(--map-zoom), 17) - 16));
			font-weight: 600;
			color: #3d5a3e;
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

	useEffect(() => {
		if (!map) return;
		const mapRef = map;

		const pane = mapRef.createPane("areaLabelsPane");
		pane.style.zIndex = "450";
		pane.style.opacity = "1";
		pane.style.transition = `opacity ${FADE_MS}ms`;

		const group = new LayerGroup(
			AREA_LABELS.map(
				({ name, position }) =>
					new Marker(position, {
						pane: "areaLabelsPane",
						icon: createLabelIcon(name),
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
	}, [map]);

	return null;
}
