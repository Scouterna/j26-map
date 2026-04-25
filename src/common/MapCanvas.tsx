import { control, Map as LMap, type PointTuple, svg, TileLayer } from "leaflet";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import "leaflet/dist/leaflet.css";
import "leaflet-edgebuffer";
import "leaflet-doubletapdrag";
import "leaflet-doubletapdragzoom";

const DEFAULT_CENTER: PointTuple = [55.98071, 14.13704];
const DEFAULT_ZOOM = 16;

const MAX_BOUNDS: [[number, number], [number, number]] = [
	[55.971, 14.115],
	[55.992, 14.157],
];

const MapContext = createContext<LMap | null>(null);

export function useMap() {
	return useContext(MapContext);
}

type Props = {
	class?: string;
	children?: ComponentChildren;
	interactive?: boolean;
	fadeAnimation?: boolean;
	center?: PointTuple;
	zoom?: number;
};

export function MapCanvas({
	class: className,
	children,
	interactive = true,
	fadeAnimation = true,
	center = DEFAULT_CENTER,
	zoom = DEFAULT_ZOOM,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [map, setMap] = useState<LMap | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const m = new LMap(containerRef.current, {
			zoomControl: false,
			fadeAnimation,
			renderer: svg({ padding: 1 }),
			maxBounds: MAX_BOUNDS,
			maxBoundsViscosity: 1,
			doubleTapDragZoom: /android/i.test(navigator.userAgent),
			doubleTapDragZoomOptions: {
				reverse: true,
			},
		});

		new TileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			maxZoom: 19,
			minZoom: 10,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			// edgeBufferTiles: 1,
		}).addTo(m);

		if (interactive) {
			control.zoom({ position: "bottomright" }).addTo(m);
			m.setMinZoom(14);
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

		function updateZoomVar() {
			containerRef.current?.style.setProperty(
				"--map-zoom",
				String(m.getZoom()),
			);
		}
		updateZoomVar();
		m.on("zoomend", updateZoomVar);

		setMap(m);

		return () => {
			m.off("zoomend", updateZoomVar);
			m.remove();
			setMap(null);
		};
	}, []);

	return (
		<MapContext.Provider value={map}>
			<div ref={containerRef} class={`w-full h-full ${className ?? ""}`} />
			{children}
		</MapContext.Provider>
	);
}
