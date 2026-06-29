import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "preact/hooks";
import { getIconURL } from "../icons";
import { getLocations } from "../locationService";
import type { Location } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { createMarkerElement } from "../marker";

// CSS classes in style.css control zoom-based opacity.
// MapLibre's _updateOpacity calls `el.style.opacity = "1"` on every move event, overriding
// anything set on the MapLibre marker element. We wrap content in an inner div: MapLibre owns
// the outer wrapper (opacity always 1), our class controls the inner element's opacity.
const PIN_CLASS = "j26-zoom-show-16";
const LABEL_CLASS = "j26-zoom-show-17";

const MARKER_SIZE = 32;

type MarkerEntry = {
	pinMarker: maplibregl.Marker;
	labelMarker: maplibregl.Marker;
	pinOuter: HTMLElement;
	labelOuter: HTMLElement;
	pinInner: HTMLElement;
	labelInner: HTMLElement;
};

type Props = {
	onLocationClick?: (loc: Location) => void;
	visibleIds?: Set<string> | null;
};

export function LocationsLayer({ onLocationClick, visibleIds = null }: Props) {
	const map = useMap();
	const [locations, setLocations] = useState<Location[]>([]);
	const markersRef = useRef<Map<string, MarkerEntry>>(new Map());

	useEffect(() => {
		getLocations().then(setLocations);
	}, []);

	useEffect(() => {
		if (!map || locations.length === 0) return;

		const entries = new Map<string, MarkerEntry>();
		const allMarkers: maplibregl.Marker[] = [];

		for (const loc of locations) {
			const lngLat: [number, number] = [loc.position[1], loc.position[0]];

			// --- Pin ---
			const pinInner = createMarkerElement(
				loc.category.color,
				getIconURL(loc.category.iconName, loc.category.iconVariant),
			);
			pinInner.classList.add(PIN_CLASS);

			const pinOuter = document.createElement("div");
			pinOuter.style.cssText = `width:${MARKER_SIZE}px;height:${MARKER_SIZE}px`;
			pinOuter.appendChild(pinInner);

			if (onLocationClick) {
				pinOuter.style.cursor = "pointer";
				pinOuter.addEventListener("click", (e) => {
					e.stopPropagation();
					onLocationClick(loc);
				});
			}

			const pinMarker = new maplibregl.Marker({ element: pinOuter, anchor: "bottom" })
				.setLngLat(lngLat)
				.addTo(map);
			allMarkers.push(pinMarker);

			// --- Label ---
			const labelInner = document.createElement("div");
			labelInner.className = `j26-label ${LABEL_CLASS}`;
			labelInner.textContent = loc.name;

			const labelOuter = document.createElement("div");
			labelOuter.style.cssText = "display:inline-block";
			labelOuter.appendChild(labelInner);

			if (onLocationClick) {
				labelOuter.style.cursor = "pointer";
				labelOuter.addEventListener("click", (e) => {
					e.stopPropagation();
					onLocationClick(loc);
				});
			}

			const labelMarker = new maplibregl.Marker({ element: labelOuter, anchor: "top", offset: [0, 2] })
				.setLngLat(lngLat)
				.addTo(map);
			allMarkers.push(labelMarker);

			entries.set(loc.id, { pinMarker, labelMarker, pinOuter, labelOuter, pinInner, labelInner });
		}

		markersRef.current = entries;

		return () => {
			for (const m of allMarkers) m.remove();
			markersRef.current = new Map();
		};
	}, [map, locations, onLocationClick]);

	// Override per-marker visibility and interactivity when visibleIds is set.
	useEffect(() => {
		const entries = markersRef.current;
		if (entries.size === 0) return;

		if (visibleIds) {
			for (const [id, { pinOuter, labelOuter, pinInner, labelInner }] of entries) {
				const visible = visibleIds.has(id);
				pinInner.style.setProperty("opacity", visible ? "1" : "0");
				labelInner.style.setProperty("opacity", visible ? "1" : "0");
				pinOuter.style.pointerEvents = visible ? "auto" : "none";
				labelOuter.style.pointerEvents = visible ? "auto" : "none";
			}
		} else {
			for (const { pinOuter, labelOuter, pinInner, labelInner } of entries.values()) {
				pinInner.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
				pinOuter.style.pointerEvents = "auto";
				labelOuter.style.pointerEvents = "auto";
			}
		}
	}, [visibleIds]);

	return null;
}
