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
// Transparent touch bridge between pin tip and label, in px.
const GAP_SIZE = 6;

type MarkerEntry = {
	marker: maplibregl.Marker;
	outer: HTMLElement;
	pinInner: HTMLElement;
	labelInner: HTMLElement;
};

type Props = {
	onLocationClick?: (loc: Location) => void;
	visibleIds?: Set<string> | null;
	activeId?: string | null;
	forceVisibleIds?: Set<string> | null;
};

export function LocationsLayer({ onLocationClick, visibleIds = null, activeId = null, forceVisibleIds = null }: Props) {
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

			const pinInner = createMarkerElement(
				loc.category.color,
				getIconURL(loc.category.iconName, loc.category.iconVariant),
			);
			pinInner.classList.add(PIN_CLASS);

			// Transparent touch bridge fills the gap between pin tip and label.
			const gap = document.createElement("div");
			gap.style.cssText = `height:${GAP_SIZE}px;width:${MARKER_SIZE}px`;

			const labelInner = document.createElement("div");
			labelInner.className = `j26-label ${LABEL_CLASS}`;
			labelInner.textContent = loc.name;

			// Single container — pin → gap → label all share one click target.
			const outer = document.createElement("div");
			outer.style.cssText = "display:flex;flex-direction:column;align-items:center";
			outer.appendChild(pinInner);
			outer.appendChild(gap);
			outer.appendChild(labelInner);

			if (onLocationClick) {
				outer.style.cursor = "pointer";
				outer.addEventListener("click", (e) => {
					e.stopPropagation();
					onLocationClick(loc);
				});
			}

			// anchor:"top" + offset [0, -MARKER_SIZE] places the pin's bottom tip at lngLat.
			const marker = new maplibregl.Marker({
				element: outer,
				anchor: "top",
				offset: [0, -MARKER_SIZE],
			})
				.setLngLat(lngLat)
				.addTo(map);
			allMarkers.push(marker);

			entries.set(loc.id, { marker, outer, pinInner, labelInner });
		}

		markersRef.current = entries;

		return () => {
			for (const m of allMarkers) m.remove();
			markersRef.current = new Map();
		};
	}, [map, locations, onLocationClick]);

	// Highlight the active pin and keep force-visible pins visible regardless of zoom.
	useEffect(() => {
		const entries = markersRef.current;
		for (const [id, { pinInner, labelInner, outer }] of entries) {
			const isActive = id === activeId;
			const forceVisible = forceVisibleIds?.has(id) ?? false;
			pinInner.classList.toggle("j26-marker-active", isActive);
			outer.style.zIndex = isActive ? "1" : "";
			// Inline opacity overrides the zoom-based CSS class opacity.
			if (isActive || forceVisible) {
				pinInner.style.opacity = "1";
				labelInner.style.opacity = "1";
			} else {
				pinInner.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
			}
		}
	}, [activeId, forceVisibleIds]);

	// Override per-marker visibility and interactivity when visibleIds is set.
	useEffect(() => {
		const entries = markersRef.current;
		if (entries.size === 0) return;

		if (visibleIds) {
			for (const [id, { outer, pinInner, labelInner }] of entries) {
				const visible = visibleIds.has(id);
				pinInner.style.setProperty("opacity", visible ? "1" : "0");
				labelInner.style.setProperty("opacity", visible ? "1" : "0");
				outer.style.pointerEvents = visible ? "auto" : "none";
			}
		} else {
			for (const { outer, pinInner, labelInner } of entries.values()) {
				pinInner.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
				outer.style.pointerEvents = "auto";
			}
		}
	}, [visibleIds]);

	return null;
}
