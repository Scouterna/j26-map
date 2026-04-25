import { LayerGroup, Marker } from "leaflet";
import { useEffect, useState } from "preact/hooks";
import { getIconURL } from "../icons";
import { getLocations } from "../locationService";
import type { Location } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { createMarkerIcon } from "../marker";

const MIN_ZOOM = 18;
const MIN_ZOOM_LABELS = 19;

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
		pane.style.transition = "opacity 250ms";
		pane.style.opacity = `clamp(0, calc((var(--map-zoom-anim) - ${MIN_ZOOM - 0.01}) * 9999), 1)`;

		const labelPane = mapRef.createPane("locationsLabelPane");
		labelPane.style.zIndex = "601";
		labelPane.style.transition = "opacity 250ms";
		labelPane.style.opacity = `clamp(0, calc((var(--map-zoom-anim) - ${MIN_ZOOM_LABELS - 0.01}) * 9999), 1)`;

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

		mapRef.addLayer(group);

		return () => {
			mapRef.removeLayer(group);
			pane.remove();
			labelPane.remove();
		};
	}, [map, locations]);

	return null;
}
