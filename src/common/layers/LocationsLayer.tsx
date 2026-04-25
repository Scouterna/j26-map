import { LayerGroup, Marker, type ZoomAnimEvent } from "leaflet";
import { useEffect, useState } from "preact/hooks";
import { getIconURL } from "../icons";
import { getLocations } from "../locationService";
import type { Location } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { createMarkerIcon } from "../marker";

const MIN_ZOOM = 18;
const MIN_ZOOM_LABELS = 19;
const FADE_MS = 250;

export function LocationsLayer() {
	const map = useMap();
	const [locations, setLocations] = useState<Location[]>([]);

	useEffect(() => {
		getLocations().then(setLocations);
	}, []);

	useEffect(() => {
		if (!map || locations.length === 0) return;
		const mapRef = map;

		const pane = mapRef.createPane("locationsPane");
		pane.style.zIndex = "600";
		pane.style.opacity = "0";
		pane.style.transition = `opacity ${FADE_MS}ms`;

		const labelPane = mapRef.createPane("locationsLabelPane");
		labelPane.style.zIndex = "601";
		labelPane.style.opacity = "0";
		labelPane.style.transition = `opacity ${FADE_MS}ms`;

		const group = new LayerGroup(
			locations.map((loc) => {
				const marker = new Marker(loc.position, {
					pane: "locationsPane",
					icon: createMarkerIcon(
						loc.category.color,
						getIconURL(loc.category.iconName, loc.category.iconVariant),
					),
				});
				marker.bindTooltip(loc.name, {
					permanent: true,
					direction: "bottom",
					className: "j26-label",
					pane: "locationsLabelPane",
					offset: [0, 2],
				});
				return marker;
			}),
		);

		function setVisibility(zoom: number) {
			pane.style.opacity = zoom >= MIN_ZOOM ? "1" : "0";
			labelPane.style.opacity = zoom >= MIN_ZOOM_LABELS ? "1" : "0";
		}

		function onZoomAnim(e: ZoomAnimEvent) {
			if (e.zoom < MIN_ZOOM) pane.style.opacity = "0";
			if (e.zoom < MIN_ZOOM_LABELS) labelPane.style.opacity = "0";
		}

		function onZoomEnd() {
			setVisibility(mapRef.getZoom());
		}

		setVisibility(mapRef.getZoom());
		mapRef.on("zoomanim", onZoomAnim);
		mapRef.on("zoomend", onZoomEnd);
		mapRef.addLayer(group);

		return () => {
			mapRef.off("zoomanim", onZoomAnim);
			mapRef.off("zoomend", onZoomEnd);
			mapRef.removeLayer(group);
			pane.remove();
			labelPane.remove();
		};
	}, [map, locations]);

	return null;
}
