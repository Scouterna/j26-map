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
const MIN_ZOOM = 18;

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

type Props = {
	/** IDs to show regardless of zoom level, e.g. from search results */
	visibleIds?: Set<string>;
};

export function LocationsLayer({ visibleIds }: Props = {}) {
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

		let lastVisible: boolean | null = null;

		function updateVisibility() {
			const visible = mapRef.getZoom() >= MIN_ZOOM;
			if (visible === lastVisible) return;
			lastVisible = visible;

			if (visible) {
				cluster.addLayers(markers);
			} else {
				const pinned = visibleIds ? markers.filter((_, i) => visibleIds.has(locations[i].id)) : [];
				cluster.removeLayers(markers.filter((_, i) => !visibleIds?.has(locations[i].id)));
				if (pinned.length) cluster.addLayers(pinned);
			}
		}

		updateVisibility();
		mapRef.on("zoomend", updateVisibility);
		mapRef.addLayer(cluster);

		return () => {
			mapRef.off("zoomend", updateVisibility);
			mapRef.removeLayer(cluster);
		};
	}, [map, locations, visibleIds]);

	return null;
}
