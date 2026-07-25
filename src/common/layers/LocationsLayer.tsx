import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "preact/hooks";
import { getIconMaskUrl } from "../icons";
import type { Location, PointTuple } from "../locationTypes";
import { useMap } from "../MapCanvas";
import {
	applyMarkerIcon,
	createMarkerElement,
	createSvgBadgeMarker,
	SVG_BADGE_WIDTH,
} from "../marker";

// CSS classes in style.css control zoom-based opacity.
// MapLibre's _updateOpacity calls `el.style.opacity = "1"` on every move event, overriding
// anything set on the MapLibre marker element. We wrap content in an inner div: MapLibre owns
// the outer wrapper (opacity always 1), our class controls the inner element's opacity.
const PIN_CLASS = "j26-zoom-show-16-5";
const LABEL_CLASS = "j26-zoom-show-17";
// Must match the threshold in j26-zoom-show-16-5 (opacity goes to 0 below this zoom).
const PIN_ZOOM_THRESHOLD = 16.5;

const MARKER_SIZE = 32;
// Transparent touch bridge between pin tip and label, in px.
const GAP_SIZE = 6;
// A click firing within this window after a dragend is treated as the drag's
// trailing click and ignored, so repositioning a pin doesn't toggle the sheet.
const DRAG_CLICK_SUPPRESS_MS = 300;

type MarkerEntry = {
	marker: maplibregl.Marker;
	outer: HTMLElement;
	pinInner: HTMLElement;
	labelInner: HTMLElement;
};

type Props = {
	locations: Location[];
	onLocationClick?: (loc: Location) => void;
	visibleIds?: Set<string> | null;
	activeId?: string | null;
	forceVisibleIds?: Set<string> | null;
	editMode?: boolean;
	onLocationMove?: (id: string, position: PointTuple) => void;
};

export function LocationsLayer({
	locations,
	onLocationClick,
	visibleIds = null,
	activeId = null,
	forceVisibleIds = null,
	editMode = false,
	onLocationMove,
}: Props) {
	const map = useMap();
	const markersRef = useRef<Map<string, MarkerEntry>>(new Map());

	// Latest callback, read from the (stable) dragend listener to avoid rebuilding
	// markers when the handler identity changes.
	const onLocationMoveRef = useRef(onLocationMove);
	onLocationMoveRef.current = onLocationMove;

	// Timestamp of the last dragend, used to suppress the click that trails a drag
	// (see DRAG_CLICK_SUPPRESS_MS). A timestamp (vs a boolean flag) can't get stuck
	// when a drag isn't followed by a click, e.g. on touch.
	const lastDragEndRef = useRef(0);

	useEffect(() => {
		if (!map || locations.length === 0) return;

		const entries = new Map<string, MarkerEntry>();
		const allMarkers: maplibregl.Marker[] = [];

		for (const loc of locations) {
			const lngLat: [number, number] = [loc.position[1], loc.position[0]];

			const isBadge = !!loc.markerSvg;
			const pinInner = isBadge
				? createSvgBadgeMarker(loc.markerSvg!)
				: createMarkerElement(loc.category.color);
			if (!isBadge) {
				// Async API, but icons are same-origin now so the mask URL resolves
				// immediately (no network fetch).
				getIconMaskUrl(loc.category.iconName, loc.category.iconVariant).then(
					(maskUrl) => {
						if (maskUrl) applyMarkerIcon(pinInner, maskUrl);
					},
				);
			}
			pinInner.classList.add(PIN_CLASS);

			// Transparent touch bridge fills the gap between pin tip and label.
			const gap = document.createElement("div");
			gap.style.cssText = `height:${GAP_SIZE}px;width:${isBadge ? SVG_BADGE_WIDTH : MARKER_SIZE}px`;

			const labelInner = document.createElement("div");
			labelInner.className = `j26-label ${LABEL_CLASS}`;
			labelInner.textContent = loc.name;

			// Single container — pin/badge → gap → label all share one click target.
			const outer = document.createElement("div");
			outer.style.cssText =
				"display:flex;flex-direction:column;align-items:center";
			outer.appendChild(pinInner);
			outer.appendChild(gap);
			outer.appendChild(labelInner);

			if (onLocationClick) {
				outer.style.cursor = "pointer";
				outer.addEventListener("click", (e) => {
					e.stopPropagation();
					// Swallow the click that trails a drag so repositioning a pin
					// doesn't also toggle the sheet.
					if (
						performance.now() - lastDragEndRef.current <
						DRAG_CLICK_SUPPRESS_MS
					) {
						return;
					}
					onLocationClick(loc);
				});
			}

			const badgeHeight = isBadge
				? Math.round(SVG_BADGE_WIDTH / (loc.markerSvgAspectRatio ?? 2))
				: 0;
			const marker = new maplibregl.Marker({
				element: outer,
				anchor: "top",
				offset: [0, -(isBadge ? badgeHeight : MARKER_SIZE)],
			})
				.setLngLat(lngLat)
				.addTo(map);

			marker.on("dragend", () => {
				lastDragEndRef.current = performance.now();
				const { lng, lat } = marker.getLngLat();
				onLocationMoveRef.current?.(loc.id, [lat, lng]);
			});

			allMarkers.push(marker);

			entries.set(loc.id, { marker, outer, pinInner, labelInner });
		}

		markersRef.current = entries;

		return () => {
			for (const m of allMarkers) m.remove();
			markersRef.current = new Map();
		};
	}, [map, locations, onLocationClick]);

	// In edit mode every pin is draggable, and all stay fully visible regardless of
	// zoom so any of them can be grabbed. Accidental moves are guarded downstream:
	// a drag only stages a move and nothing persists until the user confirms.
	useEffect(() => {
		for (const {
			marker,
			pinInner,
			labelInner,
		} of markersRef.current.values()) {
			marker.setDraggable(editMode);
			marker.getElement().style.cursor = editMode ? "grab" : "";
			if (editMode) {
				pinInner.style.opacity = "1";
				labelInner.style.opacity = "1";
			} else {
				pinInner.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
			}
		}
	}, [editMode, locations]);

	// Highlight the active pin and keep force-visible pins visible regardless of zoom.
	useEffect(() => {
		const entries = markersRef.current;
		for (const [id, { pinInner, labelInner, outer }] of entries) {
			const isActive = id === activeId;
			const forceVisible = forceVisibleIds?.has(id) ?? false;
			if (pinInner.classList.contains("j26-badge-scale")) {
				pinInner.style.setProperty("--badge-boost", isActive ? "1.35" : "1");
			} else {
				pinInner.classList.toggle("j26-marker-active", isActive);
			}
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
			for (const { pinInner, labelInner } of entries.values()) {
				pinInner.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
				// pointer-events reset is handled by the zoom effect below
			}
		}
	}, [visibleIds]);

	// Disable pointer-events on hidden markers (zoom < threshold) when not in filtered mode.
	useEffect(() => {
		if (!map || visibleIds !== null) return;

		const applyZoomPointerEvents = () => {
			const zoom = map.getZoom();
			for (const [id, { outer }] of markersRef.current) {
				const forceVisible = forceVisibleIds?.has(id) ?? false;
				outer.style.pointerEvents =
					editMode || zoom >= PIN_ZOOM_THRESHOLD || forceVisible
						? "auto"
						: "none";
			}
		};

		map.on("zoomend", applyZoomPointerEvents);
		applyZoomPointerEvents();

		return () => {
			map.off("zoomend", applyZoomPointerEvents);
		};
	}, [map, visibleIds, forceVisibleIds, locations, editMode]);

	return null;
}
