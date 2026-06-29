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

type MarkerPair = {
	pin: maplibregl.Marker;
	label: maplibregl.Marker;
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
	const markersRef = useRef<Map<string, MarkerPair>>(new Map());

	useEffect(() => {
		getLocations().then(setLocations);
	}, []);

	useEffect(() => {
		if (!map || locations.length === 0) return;

		const pairs = new Map<string, MarkerPair>();
		const pinWrappers: maplibregl.Marker[] = [];
		const labelWrappers: maplibregl.Marker[] = [];

		for (const loc of locations) {
			// --- Pin ---
			// Inner element has the zoom class; outer wrapper is what MapLibre controls.
			const pinInner = createMarkerElement(
				loc.category.color,
				getIconURL(loc.category.iconName, loc.category.iconVariant),
			);
			pinInner.classList.add(PIN_CLASS);
			pinInner.style.zIndex = "600";

			const pinOuter = document.createElement("div");
			pinOuter.style.cssText = `width:${MARKER_SIZE}px;height:${MARKER_SIZE}px`;
			pinOuter.appendChild(pinInner);

			if (onLocationClick) {
				pinOuter.style.cursor = "pointer";
				pinOuter.addEventListener("click", () => onLocationClick(loc));
			}

			const pin = new maplibregl.Marker({ element: pinOuter, anchor: "bottom" })
				.setLngLat([loc.position[1], loc.position[0]])
				.addTo(map);
			pinWrappers.push(pin);

			// --- Label ---
			const labelInner = document.createElement("div");
			labelInner.className = `j26-label ${LABEL_CLASS}`;
			labelInner.textContent = loc.name;
			labelInner.style.cssText = "pointer-events:none;z-index:601";

			const labelOuter = document.createElement("div");
			labelOuter.style.cssText = "display:inline-block;pointer-events:none";
			labelOuter.appendChild(labelInner);

			const label = new maplibregl.Marker({
				element: labelOuter,
				anchor: "top",
				offset: [0, 2],
			})
				.setLngLat([loc.position[1], loc.position[0]])
				.addTo(map);
			labelWrappers.push(label);

			pairs.set(loc.id, { pin, label, pinInner, labelInner });
		}

		markersRef.current = pairs;

		return () => {
			for (const p of pinWrappers) p.remove();
			for (const l of labelWrappers) l.remove();
			markersRef.current = new Map();
		};
	}, [map, locations, onLocationClick]);

	// Override per-marker visibility when visibleIds is set.
	// Inline style (higher specificity) overrides the zoom class; removeProperty restores it.
	useEffect(() => {
		const pairs = markersRef.current;
		if (pairs.size === 0) return;

		if (visibleIds) {
			for (const [id, { pinInner, labelInner }] of pairs) {
				const v = visibleIds.has(id) ? "1" : "0";
				pinInner.style.setProperty("opacity", v);
				labelInner.style.setProperty("opacity", v);
			}
		} else {
			for (const { pinInner, labelInner } of pairs.values()) {
				pinInner.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
			}
		}
	}, [visibleIds]);

	return null;
}
