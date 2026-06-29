import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "preact/hooks";
import { useMap } from "../MapCanvas";

const ACCURACY_SOURCE = "user-accuracy";
const ACCURACY_FILL = "user-accuracy-fill";
const ACCURACY_LINE = "user-accuracy-line";
const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

function circlePolygon(lat: number, lng: number, radiusMeters: number, points = 64) {
	const latR = radiusMeters / 111139;
	const lngR = radiusMeters / (111139 * Math.cos((lat * Math.PI) / 180));
	const coords = Array.from({ length: points + 1 }, (_, i) => {
		const angle = (i / points) * 2 * Math.PI;
		return [lng + Math.cos(angle) * lngR, lat + Math.sin(angle) * latR];
	});
	return {
		type: "Feature" as const,
		geometry: { type: "Polygon" as const, coordinates: [coords] },
		properties: {},
	};
}

export function UserLocationLayer() {
	const map = useMap();
	const [position, setPosition] = useState<GeolocationPosition | null>(null);
	const markerRef = useRef<maplibregl.Marker | null>(null);

	useEffect(() => {
		if (!navigator.geolocation) return;
		const id = navigator.geolocation.watchPosition(
			(pos) => setPosition(pos),
			(err) => console.warn("Geolocation error:", err.message),
			{ enableHighAccuracy: true },
		);
		return () => navigator.geolocation.clearWatch(id);
	}, []);

	// Create accuracy ring layers and dot marker when map is ready
	useEffect(() => {
		if (!map) return;

		map.addSource(ACCURACY_SOURCE, { type: "geojson", data: EMPTY_FC });
		map.addLayer({
			id: ACCURACY_FILL,
			type: "fill",
			source: ACCURACY_SOURCE,
			paint: { "fill-color": "#2563eb", "fill-opacity": 0.1 },
		});
		map.addLayer({
			id: ACCURACY_LINE,
			type: "line",
			source: ACCURACY_SOURCE,
			paint: { "line-color": "#2563eb", "line-width": 1, "line-opacity": 0.3 },
		});

		const el = document.createElement("div");
		el.className = "j26-user-location";
		el.style.zIndex = "700";
		el.style.pointerEvents = "none";
		markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" });

		return () => {
			markerRef.current?.remove();
			markerRef.current = null;
			if (map.getLayer(ACCURACY_LINE)) map.removeLayer(ACCURACY_LINE);
			if (map.getLayer(ACCURACY_FILL)) map.removeLayer(ACCURACY_FILL);
			if (map.getSource(ACCURACY_SOURCE)) map.removeSource(ACCURACY_SOURCE);
		};
	}, [map]);

	// Update position when geolocation changes
	useEffect(() => {
		if (!map || !position || !markerRef.current) return;

		const { latitude, longitude, accuracy } = position.coords;
		markerRef.current.setLngLat([longitude, latitude]).addTo(map);

		const data = circlePolygon(latitude, longitude, accuracy);
		(map.getSource(ACCURACY_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(
			data as GeoJSON.Feature,
		);
	}, [map, position]);

	return null;
}
