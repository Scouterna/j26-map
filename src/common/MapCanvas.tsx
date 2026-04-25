import { control, Map as LMap, type PointTuple, svg, TileLayer } from "leaflet";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import "leaflet/dist/leaflet.css";
import "leaflet-edgebuffer";

const DEFAULT_CENTER: PointTuple = [55.98071, 14.13704];
const DEFAULT_ZOOM = 16;

const MAX_BOUNDS: [[number, number], [number, number]] = [
	[55.961, 14.115],
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
			m.setMaxZoom(19);
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

		let rafId: number | null = null;

		function readAnimZoom() {
			const mapPane = m.getPanes().mapPane as HTMLElement;
			const transformStr = mapPane.style.transform;
			if (!transformStr) return m.getZoom();
			const scale = new DOMMatrix(transformStr).a;
			return scale > 0 ? m.getZoom() + Math.log2(scale) : m.getZoom();
		}

		function tickAnimZoom() {
			containerRef.current?.style.setProperty(
				"--map-zoom-anim",
				String(readAnimZoom()),
			);
			rafId = requestAnimationFrame(tickAnimZoom);
		}

		function onZoomAnimStart() {
			if (rafId === null) rafId = requestAnimationFrame(tickAnimZoom);
		}

		function onZoomAnimEnd() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			containerRef.current?.style.setProperty(
				"--map-zoom-anim",
				String(m.getZoom()),
			);
		}

		containerRef.current.style.setProperty(
			"--map-zoom-anim",
			String(m.getZoom()),
		);
		m.on("zoomanim", onZoomAnimStart);
		m.on("zoomend", onZoomAnimEnd);

		function onTouchStart(e: TouchEvent) {
			if (e.touches.length >= 2 && rafId === null)
				rafId = requestAnimationFrame(tickAnimZoom);
		}

		function onTouchEnd(e: TouchEvent) {
			if (e.touches.length === 0 && rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
				containerRef.current?.style.setProperty(
					"--map-zoom-anim",
					String(m.getZoom()),
				);
			}
		}

		containerRef.current.addEventListener("touchstart", onTouchStart, {
			passive: true,
		});
		containerRef.current.addEventListener("touchend", onTouchEnd, {
			passive: true,
		});

		setMap(m);

		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			m.off("zoomend", updateZoomVar);
			m.off("zoomanim", onZoomAnimStart);
			m.off("zoomend", onZoomAnimEnd);
			containerRef.current?.removeEventListener("touchstart", onTouchStart);
			containerRef.current?.removeEventListener("touchend", onTouchEnd);
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
