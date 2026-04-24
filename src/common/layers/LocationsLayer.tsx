import * as L from "leaflet";
import { DivIcon, Marker, type MarkerCluster } from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useEffect, useState } from "preact/hooks";
import { renderToStaticMarkup } from "preact-render-to-string";
import { getIconURL } from "../icons";
import { getLocations } from "../locationService";
import type { Category, Location } from "../locationTypes";
import { useMap } from "../MapCanvas";
import { createMarkerIcon } from "../marker";

const MARKER_SIZE = 28;

function createClusterIcon(categories: Category[]) {
	const unique = [...new Set(categories.map((c) => c.color))];
	const color = unique.length === 1 ? unique[0] : "#334155";
	const icon = unique.length === 1 ? categories[0] : null;

	const html = renderToStaticMarkup(
		<div
			className="size-7 rounded-full border border-white shadow-xs flex items-center justify-center text-white text-sm font-bold"
			style={{ backgroundColor: color }}
		>
			{icon ? (
				<div
					className="absolute inset-0 p-1.5 bg-white mask-no-repeat mask-contain mask-center mask-origin-content"
					style={{
						maskImage: `url('${getIconURL(icon.iconName, icon.iconVariant)}')`,
					}}
				/>
			) : (
				<span>{categories.length}</span>
			)}
		</div>,
	);

	return new DivIcon({
		className: "j26-marker",
		html,
		iconSize: [MARKER_SIZE, MARKER_SIZE],
		iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
	});
}

const PRIORITY_MIN_ZOOM: Record<number, number> = {
	1: 15,
	2: 16,
	3: 17,
	4: 18,
};

export function LocationsLayer() {
	const map = useMap();
	const [locations, setLocations] = useState<Location[]>([]);

	useEffect(() => {
		getLocations().then(setLocations);
	}, []);

	useEffect(() => {
		if (!map || locations.length === 0) return;
		const mapRef = map;

		const cluster = new L.MarkerClusterGroup({
			showCoverageOnHover: false,
			maxClusterRadius: 30,
			disableClusteringAtZoom: 18,
			removeOutsideVisibleBounds: false,
			iconCreateFunction(group: MarkerCluster) {
				const categories = group
					.getAllChildMarkers()
					.map((m) => (m.options as { category: Category }).category);
				return createClusterIcon(categories);
			},
		});

		const markers = locations.map(
			(loc) =>
				new Marker(loc.position, {
					icon: createMarkerIcon(
						loc.category.color,
						getIconURL(loc.category.iconName, loc.category.iconVariant),
					),
					...({ category: loc.category } as object),
				}),
		);

		const thresholds = [...new Set(Object.values(PRIORITY_MIN_ZOOM))].sort((a, b) => a - b);
		let lastThresholdZoom: number | null = null;

		function getThresholdZoom(zoom: number) {
			// Which thresholds are currently active (zoom >= threshold)
			return thresholds.filter((t) => zoom >= t).length;
		}

		function updateVisibility() {
			const zoom = mapRef.getZoom();
			const thresholdZoom = getThresholdZoom(zoom);
			if (thresholdZoom === lastThresholdZoom) return;
			lastThresholdZoom = thresholdZoom;

			const toAdd: L.Layer[] = [];
			const toRemove: L.Layer[] = [];
			for (const [i, marker] of markers.entries()) {
				const minZoom = PRIORITY_MIN_ZOOM[locations[i].category.priority];
				if (zoom >= minZoom) {
					toAdd.push(marker);
				} else {
					toRemove.push(marker);
				}
			}
			cluster.addLayers(toAdd);
			cluster.removeLayers(toRemove);
		}

		updateVisibility();
		mapRef.on("zoomend", updateVisibility);
		mapRef.addLayer(cluster);

		return () => {
			mapRef.off("zoomend", updateVisibility);
			mapRef.removeLayer(cluster);
		};
	}, [map, locations]);

	return null;
}
