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
const PIN_CLASS = "j26-zoom-show-16";
const LABEL_CLASS = "j26-zoom-show-16";
// Must match the threshold in j26-zoom-show-16 (opacity goes to 0 below this zoom).
const PIN_ZOOM_THRESHOLD = 16;

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
	// Element carrying the zoom fade (the pin shape, or the badge itself). Inline
	// opacity overrides must go here, not on pinInner, or they'd also reveal/hide
	// the declutter dot.
	pinFade: HTMLElement;
	labelInner: HTMLElement;
	isBadge: boolean;
	labelWidth: number;
	baseZ: number;
};

// z-index for the active pin — above every latitude-ranked base z-index.
const ACTIVE_Z = 100000;

// Collision uses each marker's screen-space footprint (pin + label box). Labels
// are a fixed pixel size, so as you zoom out the pins draw closer together while
// the labels stay as wide — which is why labels overlap before the pins do.
const PIN_HALF_WIDTH = 15; // ≈ half the 32px pin box
const LABEL_HEIGHT = 16; // 11px text + vertical padding
const BOX_PADDING = 2; // breathing room between footprints
// Labels only render at/above this zoom (matches .j26-zoom-show-16 in style.css);
// below it, collision considers the pin box only.
const LABEL_ZOOM_THRESHOLD = 16;
// At/above this zoom (the map's max) decluttering is disabled entirely — every
// pin shows in full regardless of overlap.
const DECLUTTER_DISABLE_ZOOM = 19;

// Label text and font size never change, so a label's pixel width is constant
// across zoom — measure once with a cached canvas (no layout reflow).
let labelCanvasCtx: CanvasRenderingContext2D | null = null;
function measureLabelWidth(text: string): number {
	if (!labelCanvasCtx) {
		labelCanvasCtx = document.createElement("canvas").getContext("2d");
		if (labelCanvasCtx) {
			labelCanvasCtx.font = '600 11px "Source Sans 3 Variable", sans-serif';
		}
	}
	// +8 for the label's 4px horizontal padding on each side.
	return (labelCanvasCtx?.measureText(text).width ?? text.length * 6) + 8;
}

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

		// Static z-index by latitude: northernmost (top of screen) lowest, so pins
		// further down on screen render above those further up. Relative screen
		// order by latitude is invariant to pan/zoom, so this never needs recomputing.
		const zRank = new Map<string, number>();
		[...locations]
			.sort((a, b) => b.position[0] - a.position[0])
			.forEach((loc, i) => zRank.set(loc.id, i));

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
			// The zoom fade goes on the pin shape, not the container, so the
			// declutter dot inside it keeps its own (inverse) zoom opacity.
			// Badges have no inner pin element, so they fade as a whole.
			const pinFade =
				pinInner.querySelector<HTMLElement>(".j26-marker-pin") ?? pinInner;
			pinFade.classList.add(PIN_CLASS);
			// Opt into the always-visible dot (see .j26-dotify in style.css).
			if (!isBadge) pinInner.classList.add("j26-dotify");

			// Transparent touch bridge fills the gap between pin tip and label.
			const gap = document.createElement("div");
			gap.style.cssText = `height:${GAP_SIZE}px;width:${isBadge ? SVG_BADGE_WIDTH : MARKER_SIZE}px`;

			const labelInner = document.createElement("div");
			labelInner.className = `j26-label ${LABEL_CLASS}`;
			labelInner.textContent = loc.name;

			// Single container — pin/badge → gap → label all share one click target.
			const baseZ = zRank.get(loc.id) ?? 0;
			const outer = document.createElement("div");
			outer.style.cssText =
				"display:flex;flex-direction:column;align-items:center";
			outer.style.zIndex = String(baseZ);
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

			entries.set(loc.id, {
				marker,
				outer,
				pinInner,
				pinFade,
				labelInner,
				isBadge,
				labelWidth: measureLabelWidth(loc.name),
				baseZ,
			});
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
			pinFade,
			labelInner,
		} of markersRef.current.values()) {
			marker.setDraggable(editMode);
			marker.getElement().style.cursor = editMode ? "grab" : "";
			pinInner.classList.toggle("j26-pin-forced", editMode);
			if (editMode) {
				pinFade.style.opacity = "1";
				labelInner.style.opacity = "1";
			} else {
				pinFade.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
			}
		}
	}, [editMode, locations]);

	// Highlight the active pin and keep force-visible pins visible regardless of zoom.
	useEffect(() => {
		const entries = markersRef.current;
		for (const [
			id,
			{ pinInner, pinFade, labelInner, outer, baseZ },
		] of entries) {
			const isActive = id === activeId;
			const forceVisible = forceVisibleIds?.has(id) ?? false;
			if (pinInner.classList.contains("j26-badge-scale")) {
				pinInner.style.setProperty("--badge-boost", isActive ? "1.35" : "1");
			} else {
				pinInner.classList.toggle("j26-marker-active", isActive);
			}
			// Active pin above all; otherwise keep its latitude-based base z-index.
			outer.style.zIndex = String(isActive ? ACTIVE_Z : baseZ);
			// Inline opacity overrides the zoom-based CSS class opacity; the
			// j26-pin-forced class suppresses the dot that would otherwise show
			// below the pin tip at low zoom.
			pinInner.classList.toggle("j26-pin-forced", isActive || forceVisible);
			if (isActive || forceVisible) {
				pinFade.style.opacity = "1";
				labelInner.style.opacity = "1";
			} else {
				pinFade.style.removeProperty("opacity");
				labelInner.style.removeProperty("opacity");
			}
		}
	}, [activeId, forceVisibleIds]);

	// Override per-marker visibility and interactivity when visibleIds is set.
	useEffect(() => {
		const entries = markersRef.current;
		if (entries.size === 0) return;

		if (visibleIds) {
			for (const [id, { outer, pinInner, pinFade, labelInner }] of entries) {
				const visible = visibleIds.has(id);
				pinInner.classList.toggle("j26-pin-forced", visible);
				pinFade.style.setProperty("opacity", visible ? "1" : "0");
				labelInner.style.setProperty("opacity", visible ? "1" : "0");
				outer.style.pointerEvents = visible ? "auto" : "none";
			}
		} else {
			for (const { pinInner, pinFade, labelInner } of entries.values()) {
				pinInner.classList.remove("j26-pin-forced");
				pinFade.style.removeProperty("opacity");
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

	// Declutter: collapse crowded pins to dots. Relative screen distances between
	// two points depend only on zoom (not pan), so we recompute as zoom changes.
	// We listen to the continuous `zoom` event (not `zoomend`) so pins re-expand
	// live during the zoom gesture rather than snapping only when it settles.
	// A greedy pass keeps the first pin in each cluster full and dots the rest;
	// the active pin sorts first so it is never the one that gets dotted.
	useEffect(() => {
		if (!map) return;

		const applyDeclutter = () => {
			const entries = markersRef.current;
			if (entries.size === 0) return;

			const zoom = map.getZoom();
			const isShown = (id: string) => {
				if (editMode) return true;
				if (id === activeId) return true;
				if (forceVisibleIds?.has(id)) return true;
				if (visibleIds) return visibleIds.has(id);
				return zoom >= PIN_ZOOM_THRESHOLD;
			};

			// Active pin first (so it stays full), then insertion order.
			const order = activeId
				? [
						activeId,
						...locations.filter((l) => l.id !== activeId).map((l) => l.id),
					]
				: locations.map((l) => l.id);

			// Labels contribute to the footprint only when they're actually shown.
			const labelsVisible = zoom >= LABEL_ZOOM_THRESHOLD;
			// At max zoom, skip the collision pass so nothing collapses.
			const declutter = zoom < DECLUTTER_DISABLE_ZOOM;

			type Box = { left: number; right: number; top: number; bottom: number };
			const kept: Box[] = [];
			const dottedIds = new Set<string>();

			for (const id of declutter ? order : []) {
				const entry = entries.get(id);
				// Badges are large, few, and visually distinct — leave them as-is.
				if (!entry || entry.isBadge || !isShown(id)) continue;

				const { lng, lat } = entry.marker.getLngLat();
				const p = map.project([lng, lat]);

				// Pin box sits above the location point (the tip is at p); the label
				// box sits below it. Widen to whichever is wider.
				const halfWidth = Math.max(
					PIN_HALF_WIDTH,
					labelsVisible ? entry.labelWidth / 2 : 0,
				);
				const box: Box = {
					left: p.x - halfWidth - BOX_PADDING,
					right: p.x + halfWidth + BOX_PADDING,
					top: p.y - MARKER_SIZE - BOX_PADDING,
					bottom:
						p.y + (labelsVisible ? GAP_SIZE + LABEL_HEIGHT : 0) + BOX_PADDING,
				};

				const collides = kept.some(
					(q) =>
						box.left < q.right &&
						box.right > q.left &&
						box.top < q.bottom &&
						box.bottom > q.top,
				);

				if (collides) {
					dottedIds.add(id);
				} else {
					kept.push(box);
				}
			}

			for (const [id, { pinInner, labelInner }] of entries) {
				const dotted = dottedIds.has(id);
				pinInner.classList.toggle("j26-dotted", dotted);
				labelInner.classList.toggle("j26-declutter-hide", dotted);
			}
		};

		map.on("zoom", applyDeclutter);
		applyDeclutter();

		return () => {
			map.off("zoom", applyDeclutter);
		};
	}, [map, locations, visibleIds, activeId, forceVisibleIds, editMode]);

	return null;
}
