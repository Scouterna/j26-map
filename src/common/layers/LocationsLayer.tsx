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

		function updateVisibility() {
			const zoom = map!.getZoom();
			for (const [i, marker] of markers.entries()) {
				const minZoom = PRIORITY_MIN_ZOOM[locations[i].category.priority];
				if (zoom >= minZoom) {
					cluster.addLayer(marker);
				} else {
					cluster.removeLayer(marker);
				}
			}
		}

		updateVisibility();
		map.on("zoomend", updateVisibility);
		map.addLayer(cluster);

		return () => {
			map.off("zoomend", updateVisibility);
			map.removeLayer(cluster);
		};
	}, [map, locations]);

	return null;
}
