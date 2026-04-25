import type { Feature } from "geojson";
import { GeoJSON, type Map as LMap, type PointTuple } from "leaflet";
import { useEffect, useRef } from "preact/hooks";
import { useMap } from "../common/MapCanvas";
import type { SearchResult } from "../common/searchTypes";

/** Shift a lat/lng so it appears in the center of the area above the bottom sheet. */
function sheetAdjustedCenter(
	map: LMap,
	latLng: PointTuple,
	zoom: number,
	sheetH: number,
): PointTuple {
	const shiftPx = sheetH / 2;
	const px = map.project(latLng, zoom).add([0, shiftPx]);
	const adjusted = map.unproject(px, zoom);
	return [adjusted.lat, adjusted.lng];
}

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
		[minLat, minLng],
		[maxLat, maxLng],
	];
}

type Props = {
	selectedResult: SearchResult | null;
	getSheetHeight: () => number;
};

export function MapInteraction({ selectedResult, getSheetHeight }: Props) {
	const map = useMap();
	const highlightRef = useRef<GeoJSON | null>(null);

	useEffect(() => {
		if (!map) return;

		if (highlightRef.current) {
			map.removeLayer(highlightRef.current);
			highlightRef.current = null;
		}

		if (!selectedResult) return;

		const sheetH = getSheetHeight();
		const fitOpts = {
			paddingTopLeft: [60, 60] as [number, number],
			paddingBottomRight: [60, 60 + sheetH] as [number, number],
		};

		if (selectedResult.type === "location") {
			const center = sheetAdjustedCenter(
				map,
				selectedResult.location.position,
				18,
				sheetH,
			);
			map.flyTo(center, 18);
		} else if (selectedResult.type === "group") {
			const positions = selectedResult.locations.map((l) => l.position);
			if (positions.length > 0) {
				const lats = positions.map((p) => p[0]);
				const lngs = positions.map((p) => p[1]);
				map.fitBounds(
					[
						[Math.min(...lats), Math.min(...lngs)],
						[Math.max(...lats), Math.max(...lngs)],
					],
					{ ...fitOpts, maxZoom: 18 },
				);
			}
		} else if (selectedResult.type === "district") {
			const bounds = featureBounds(selectedResult.feature);
			if (bounds) map.fitBounds(bounds, fitOpts);
		} else if (selectedResult.type === "village") {
			const center = sheetAdjustedCenter(map, selectedResult.labelPoint, 18, sheetH);
			map.flyTo(center, 18);
			if (selectedResult.polygon) {
				// biome-ignore lint/suspicious/noExplicitAny: Leaflet GeoJSON accepts Feature but types are loose
				const layer = new GeoJSON(selectedResult.polygon as any, {
					style: () => ({ color: "#2563eb", weight: 3, fillOpacity: 0 }),
				});
				layer.addTo(map);
				highlightRef.current = layer;
			}
		}

		return () => {
			if (highlightRef.current) {
				map.removeLayer(highlightRef.current);
				highlightRef.current = null;
			}
		};
	}, [selectedResult, map, getSheetHeight]);

	return null;
}
