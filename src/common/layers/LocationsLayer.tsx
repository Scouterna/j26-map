import { LayerGroup, Marker } from "leaflet";
import { useEffect, useRef, useState } from "preact/hooks";
import { getIconURL } from "../icons";
import { getLocations } from "../locationService";
import type { Location } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { createMarkerIcon } from "../marker";

const MIN_ZOOM = 18;
const MIN_ZOOM_LABELS = 19;

const ZOOM_OPACITY = `clamp(0, calc((var(--map-zoom-anim) - ${MIN_ZOOM - 0.01}) * 9999), 1)`;
const ZOOM_OPACITY_LABELS = `clamp(0, calc((var(--map-zoom-anim) - ${MIN_ZOOM_LABELS - 0.01}) * 9999), 1)`;

type Props = {
	onLocationClick?: (loc: Location) => void;
	/** null = all locations use zoom-based visibility; a Set = only those IDs are shown */
	visibleIds?: Set<string> | null;
};

export function LocationsLayer({ onLocationClick, visibleIds = null }: Props) {
	const map = useMap();
	const [locations, setLocations] = useState<Location[]>([]);
	const paneRef = useRef<HTMLElement | null>(null);
	const labelPaneRef = useRef<HTMLElement | null>(null);
	const markersRef = useRef<Map<string, Marker>>(new Map());

	useEffect(() => {
		getLocations().then(setLocations);
	}, []);

	useEffect(() => {
		if (!map || locations.length === 0) return;
		const mapRef = map;

		const pane = mapRef.createPane("locationsPane");
		pane.style.zIndex = "600";
		pane.style.transition = "opacity 250ms";
		pane.style.opacity = ZOOM_OPACITY;
		paneRef.current = pane;

		const labelPane = mapRef.createPane("locationsLabelPane");
		labelPane.style.zIndex = "601";
		labelPane.style.transition = "opacity 250ms";
		labelPane.style.opacity = ZOOM_OPACITY_LABELS;
		labelPaneRef.current = labelPane;

		const markers = new Map<string, Marker>();
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
				if (onLocationClick) marker.on("click", () => onLocationClick(loc));
				markers.set(loc.id, marker);
				return marker;
			}),
		);
		markersRef.current = markers;

		mapRef.addLayer(group);

		return () => {
			mapRef.removeLayer(group);
			pane.remove();
			labelPane.remove();
			paneRef.current = null;
			labelPaneRef.current = null;
			markersRef.current = new Map();
		};
	}, [map, locations, onLocationClick]);

	// Update pane opacity and individual marker visibility when visibleIds changes
	useEffect(() => {
		if (!paneRef.current || !labelPaneRef.current) return;

		if (visibleIds) {
			paneRef.current.style.opacity = "1";
			labelPaneRef.current.style.opacity = "1";
			for (const [id, marker] of markersRef.current) {
				const visible = visibleIds.has(id);
				marker.setOpacity(visible ? 1 : 0);
				marker.getTooltip()?.setOpacity(visible ? 1 : 0);
			}
		} else {
			paneRef.current.style.opacity = ZOOM_OPACITY;
			labelPaneRef.current.style.opacity = ZOOM_OPACITY_LABELS;
			for (const marker of markersRef.current.values()) {
				marker.setOpacity(1);
				marker.getTooltip()?.setOpacity(1);
			}
		}
	}, [visibleIds]);

	return null;
}
