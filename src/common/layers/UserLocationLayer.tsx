import { Circle, DivIcon, Marker } from "leaflet";
import { useEffect, useRef, useState } from "preact/hooks";
import { useMap } from "../MapCanvas";

export function UserLocationLayer() {
	const map = useMap();
	const [position, setPosition] = useState<GeolocationPosition | null>(null);
	const markerRef = useRef<Marker | null>(null);
	const accuracyRef = useRef<Circle | null>(null);
	const addedRef = useRef(false);

	useEffect(() => {
		if (!navigator.geolocation) return;

		const id = navigator.geolocation.watchPosition(
			(pos) => setPosition(pos),
			(err) => console.warn("Geolocation error:", err.message),
			{ enableHighAccuracy: true },
		);

		return () => navigator.geolocation.clearWatch(id);
	}, []);

	// Create markers once when map is ready; clean up on unmount.
	useEffect(() => {
		if (!map) return;

		if (!map.getPane("userLocationPane")) {
			const pane = map.createPane("userLocationPane");
			pane.style.zIndex = "700";
			pane.style.pointerEvents = "none";
		}

		const icon = new DivIcon({
			className: "",
			iconSize: [20, 20],
			iconAnchor: [10, 10],
			html: '<div class="j26-user-location"></div>',
		});

		markerRef.current = new Marker([0, 0], {
			pane: "userLocationPane",
			icon,
			interactive: false,
		});
		accuracyRef.current = new Circle([0, 0], {
			pane: "userLocationPane",
			radius: 0,
			color: "#2563eb",
			fillColor: "#2563eb",
			fillOpacity: 0.1,
			weight: 1,
			opacity: 0.3,
			interactive: false,
		});

		return () => {
			markerRef.current?.remove();
			accuracyRef.current?.remove();
			markerRef.current = null;
			accuracyRef.current = null;
			addedRef.current = false;
		};
	}, [map]);

	// Update marker position whenever geolocation changes.
	useEffect(() => {
		if (!map || !position || !markerRef.current || !accuracyRef.current) return;

		const { latitude, longitude, accuracy } = position.coords;
		const latlng: [number, number] = [latitude, longitude];

		markerRef.current.setLatLng(latlng);
		accuracyRef.current.setLatLng(latlng);
		accuracyRef.current.setRadius(accuracy);

		if (!addedRef.current) {
			markerRef.current.addTo(map);
			accuracyRef.current.addTo(map);
			addedRef.current = true;
		}
	}, [map, position]);

	return null;
}
