import type { Feature } from "geojson";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "preact/hooks";
import type { PointTuple } from "../common/locationTypes";
import { toLngLat } from "../common/locationTypes";
import { useMap } from "../common/MapCanvas";
import type { SearchResult } from "../common/searchTypes";
import { getVillageAtPoint } from "../common/villageService";

const HIGHLIGHT_SOURCE = "village-highlight";
const HIGHLIGHT_LAYER = "village-highlight-line";

// Returns [[minLng, minLat], [maxLng, maxLat]] for use with MapLibre fitBounds
function featureBounds(
	feature: Feature,
): [[number, number], [number, number]] | null {
	const geom = feature.geometry;
	if (!geom) return null;

	let coords: number[][] = [];
	if (geom.type === "Polygon") coords = geom.coordinates.flat();
	else if (geom.type === "MultiPolygon") coords = geom.coordinates.flat(2);
	else if (geom.type === "LineString") coords = geom.coordinates;
	if (coords.length === 0) return null;

	let minLat = Infinity,
		maxLat = -Infinity,
		minLng = Infinity,
		maxLng = -Infinity;
	for (const [lng, lat] of coords) {
		if (lat < minLat) minLat = lat;
		if (lat > maxLat) maxLat = lat;
		if (lng < minLng) minLng = lng;
		if (lng > maxLng) maxLng = lng;
	}
	return [
		[minLng, minLat],
		[maxLng, maxLat],
	];
}

type Props = {
	selectedResult: SearchResult | null;
	getSheetHeight: () => number;
	onMapClick?: () => void;
	onResultClick?: (result: SearchResult) => void;
};

export function MapInteraction({ selectedResult, getSheetHeight, onMapClick, onResultClick }: Props) {
	const map = useMap();
	const highlightRef = useRef(false);
	const onMapClickRef = useRef(onMapClick);
	onMapClickRef.current = onMapClick;
	const onResultClickRef = useRef(onResultClick);
	onResultClickRef.current = onResultClick;

	useEffect(() => {
		if (!map) return;
		const handler = async (e: maplibregl.MapMouseEvent) => {
			const village = await getVillageAtPoint(e.lngLat.lng, e.lngLat.lat);
			if (village) {
				onResultClickRef.current?.(village);
			} else {
				onMapClickRef.current?.();
			}
		};
		map.on("click", handler);
		return () => map.off("click", handler);
	}, [map]);

	// Close sheet when the selected location pin pans off-screen or under the sheet.
	useEffect(() => {
		if (!map || !onMapClick || !selectedResult || selectedResult.type !== "location") return;
		const lngLat = toLngLat(selectedResult.location.position);
		// Pin is 32px tall, anchored at its tip. Check against its visual center (16px above tip).
		const PIN_HALF = 20;
		const handler = () => {
			const { x, y } = map.project(lngLat);
			const pinCenterY = y - PIN_HALF;
			const container = map.getContainer();
			const w = container.clientWidth;
			const h = container.clientHeight;
			const offScreen = pinCenterY < 0 || pinCenterY > h || x < 0 || x > w;
			const behindSheet = pinCenterY > h - getSheetHeight();
			if (offScreen || behindSheet) onMapClickRef.current?.();
		};
		map.on("moveend", handler);
		return () => map.off("moveend", handler);
	}, [map, selectedResult, !!onMapClick]);

	useEffect(() => {
		if (!map) return;

		// Remove previous highlight
		if (highlightRef.current) {
			if (map.getLayer(HIGHLIGHT_LAYER)) map.removeLayer(HIGHLIGHT_LAYER);
			if (map.getSource(HIGHLIGHT_SOURCE)) map.removeSource(HIGHLIGHT_SOURCE);
			highlightRef.current = false;
		}

		if (!selectedResult) return;

		const sheetH = getSheetHeight();
		const fitPadding = {
			top: 60,
			bottom: 60 + sheetH,
			left: 60,
			right: 60,
		};

		if (selectedResult.type === "location") {
			map.easeTo({
				center: toLngLat(selectedResult.location.position),
				zoom: 18,
				offset: [0, -(sheetH / 2)] as [number, number],
				duration: 500,
				easing: (t) => 1 - Math.pow(1 - t, 3),
			});
		} else if (selectedResult.type === "group") {
			const positions = selectedResult.locations.map((l) => l.position);
			if (positions.length > 0) {
				const lats = positions.map((p) => p[0]);
				const lngs = positions.map((p) => p[1]);
				const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
				const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
				map.fitBounds([sw, ne], { padding: fitPadding, maxZoom: 18 });
			}
		} else if (selectedResult.type === "district") {
			const bounds = featureBounds(selectedResult.feature);
			if (bounds) map.fitBounds(bounds, { padding: fitPadding });
		} else if (selectedResult.type === "village") {
			map.flyTo({
				center: toLngLat(selectedResult.labelPoint as PointTuple),
				zoom: 18,
				offset: [0, -(sheetH / 2)] as [number, number],
			});
			if (selectedResult.polygon) {
				map.addSource(HIGHLIGHT_SOURCE, {
					type: "geojson",
					data: selectedResult.polygon as GeoJSON.Feature,
				});
				map.addLayer({
					id: HIGHLIGHT_LAYER,
					type: "line",
					source: HIGHLIGHT_SOURCE,
					paint: { "line-color": "#2563eb", "line-width": 3 },
				});
				highlightRef.current = true;
			}
		}

		return () => {
			if (highlightRef.current) {
				if (map.getLayer(HIGHLIGHT_LAYER)) map.removeLayer(HIGHLIGHT_LAYER);
				if (map.getSource(HIGHLIGHT_SOURCE)) map.removeSource(HIGHLIGHT_SOURCE);
				highlightRef.current = false;
			}
		};
	}, [selectedResult, map, getSheetHeight]);

	return null;
}
