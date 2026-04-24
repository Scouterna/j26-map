import { LayerGroup, Marker } from "leaflet";
import { useEffect, useState } from "preact/hooks";
import { getIconURL } from "../icons";
import { getLocations } from "../locationService";
import type { Location } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { createMarkerIcon } from "../marker";

const MIN_ZOOM = 18;
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

		const group = new LayerGroup(
			locations.map(
				(loc) =>
					new Marker(loc.position, {
						pane: "locationsPane",
						icon: createMarkerIcon(
							loc.category.color,
							getIconURL(loc.category.iconName, loc.category.iconVariant),
						),
					}),
			),
		);

		function updateVisibility() {
			pane.style.opacity = mapRef.getZoom() >= MIN_ZOOM ? "1" : "0";
		}

		updateVisibility();
		mapRef.on("zoomend", updateVisibility);
		mapRef.addLayer(group);

		return () => {
			mapRef.off("zoomend", updateVisibility);
			mapRef.removeLayer(group);
			pane.remove();
		};
	}, [map, locations]);

	return null;
}
