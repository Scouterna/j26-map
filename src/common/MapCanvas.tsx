import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import type { PointTuple } from "./locationTypes";

const DEFAULT_CENTER: PointTuple = [55.98071, 14.13704];
const DEFAULT_ZOOM = 16;

// [sw, ne] as [lng, lat] pairs
const MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
	[14.115, 55.961],
	[14.157, 55.992],
];

const MapContext = createContext<maplibregl.Map | null>(null);

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
	const [map, setMap] = useState<maplibregl.Map | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		containerRef.current.style.setProperty("--map-zoom", String(zoom));
		containerRef.current.style.setProperty("--map-zoom-anim", String(zoom));

		const m = new maplibregl.Map({
			container: containerRef.current,
			style: {
				version: 8,
				sources: {
					osm: {
						type: "raster",
						tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
						tileSize: 256,
						attribution:
							'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
						minzoom: 10,
						maxzoom: 19,
					},
				},
				layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
			},
			center: [center[1], center[0]], // [lng, lat]
			zoom,
			maxBounds: MAX_BOUNDS,
			...(interactive && { minZoom: 14, maxZoom: 19 }),
			dragRotate: false,
			touchPitch: false,
		});

		if (interactive) {
			m.touchZoomRotate.disableRotation();
			m.addControl(
				new maplibregl.NavigationControl({ showCompass: false }),
				"bottom-right",
			);
		} else {
			m.dragPan.disable();
			m.scrollZoom.disable();
			m.doubleClickZoom.disable();
			m.touchZoomRotate.disable();
			m.keyboard.disable();
			m.boxZoom.disable();
			m.dragRotate.disable();
		}

		const updateZoom = () => {
			containerRef.current?.style.setProperty("--map-zoom", String(m.getZoom()));
		};
		const updateAnimZoom = () => {
			containerRef.current?.style.setProperty(
				"--map-zoom-anim",
				String(m.getZoom()),
			);
		};

		m.on("zoomend", updateZoom);
		m.on("move", updateAnimZoom);

		m.once("load", () => {
			updateZoom();
			updateAnimZoom();
			setMap(m);
		});

		return () => {
			m.off("zoomend", updateZoom);
			m.off("move", updateAnimZoom);
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
