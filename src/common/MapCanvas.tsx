import { control, Map as LMap, TileLayer, type PointTuple } from "leaflet";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import "leaflet/dist/leaflet.css";
import "./map.css";

const DEFAULT_CENTER: PointTuple = [55.98071, 14.13704];
const DEFAULT_ZOOM = 16;

const MapContext = createContext<LMap | null>(null);

export function useMap() {
	return useContext(MapContext);
}

type Props = {
	class?: string;
	children?: ComponentChildren;
	interactive?: boolean;
	center?: PointTuple;
	zoom?: number;
};

export function MapCanvas({
	class: className,
	children,
	interactive = true,
	center = DEFAULT_CENTER,
	zoom = DEFAULT_ZOOM,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [map, setMap] = useState<LMap | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const m = new LMap(containerRef.current, { zoomControl: false });

		new TileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			maxZoom: 20,
			minZoom: 12,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		}).addTo(m);

		if (interactive) {
			control.zoom({ position: "bottomright" }).addTo(m);
			m.setMinZoom(15);
			m.setMaxZoom(18);
		} else {
			m.dragging.disable();
			m.touchZoom.disable();
			m.doubleClickZoom.disable();
			m.scrollWheelZoom.disable();
			m.boxZoom.disable();
			m.keyboard.disable();
			m.attributionControl.setPrefix("");
		}

		m.setView(center, zoom);
		setMap(m);

		return () => {
			m.remove();
			setMap(null);
		};
	}, []);

	return (
		<MapContext.Provider value={map}>
			<div ref={containerRef} class={`w-full h-full ${className ?? ""}`} />
			{map && children}
		</MapContext.Provider>
	);
}
