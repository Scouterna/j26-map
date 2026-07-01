import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol as PmtilesProtocol } from "pmtiles";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import osmTilesUrl from "./assets/osm.pmtiles?url";
import type { PointTuple } from "./locationTypes";

const pmtilesProtocol = new PmtilesProtocol();
maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile);

const DEFAULT_CENTER: PointTuple = [55.98071, 14.13704];
const DEFAULT_ZOOM = 16;

// [sw, ne] as [lng, lat] pairs
const MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
	[14.115, 55.961],
	[14.157, 55.992],
];

// Style for the "osm" Shortbread vector source (see https://shortbread-tiles.org),
// colored close to the classic OSM Carto look via the "kind" attribute.
const OSM_LAYERS: maplibregl.LayerSpecification[] = [
	{
		id: "osm-background",
		type: "background",
		paint: { "background-color": "#f2efe9" },
	},
	{
		id: "osm-land",
		type: "fill",
		source: "osm",
		"source-layer": "land",
		paint: {
			"fill-color": [
				"match",
				["get", "kind"],
				["forest", "wood"],
				"#c8dfae",
				["grass", "meadow", "park", "village_green", "national_park"],
				"#cdebb0",
				["farmland", "farm", "orchard", "vineyard"],
				"#eef0d5",
				["residential", "urban"],
				"#e0dfdf",
				["industrial", "commercial", "railway"],
				"#ebdbe8",
				["sand", "beach"],
				"#f2e6b9",
				["wetland", "marsh"],
				"#a5c9c1",
				["glacier", "ice"],
				"#ffffff",
				["cemetery"],
				"#aad3af",
				["hospital"],
				"#f3d9d9",
				["school", "university", "college"],
				"#f0e0d6",
				["pitch", "sports_centre", "stadium"],
				"#c9f0c0",
				"#f2efe9",
			],
		},
	},
	{
		id: "osm-water",
		type: "fill",
		source: "osm",
		"source-layer": "water_polygons",
		paint: { "fill-color": "#aad3df" },
	},
	{
		id: "osm-buildings",
		type: "fill",
		source: "osm",
		"source-layer": "buildings",
		paint: { "fill-color": "#d9d0c9" },
	},
	{
		id: "osm-streets",
		type: "line",
		source: "osm",
		"source-layer": "streets",
		paint: {
			"line-color": [
				"match",
				["get", "kind"],
				["motorway"],
				"#e892a2",
				["trunk"],
				"#f9b29c",
				["primary"],
				"#fcd6a4",
				["secondary", "tertiary"],
				"#f7fabf",
				["path", "track", "footway", "steps", "cycleway", "bridleway"],
				"#d9a679",
				"#ffffff",
			],
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				14,
				["match", ["get", "kind"], ["motorway", "trunk", "primary"], 2, 1],
				19,
				["match", ["get", "kind"], ["motorway", "trunk", "primary"], 9, 5],
			],
		},
	},
	{
		id: "osm-street-labels",
		type: "symbol",
		source: "osm",
		"source-layer": "street_labels",
		layout: {
			"symbol-placement": "line",
			"text-field": ["get", "name"],
			"text-font": ["Klokantech Noto Sans Regular"],
			"text-size": 11,
		},
		paint: {
			"text-color": "#6b6b6b",
			"text-halo-color": "#ffffff",
			"text-halo-width": 1,
		},
	},
];

const MapContext = createContext<maplibregl.Map | null>(null);

export function useMap() {
	return useContext(MapContext);
}

type Props = {
	class?: string;
	children?: ComponentChildren;
	interactive?: boolean;
	osmTiles?: boolean;
	attribution?: boolean;
	center?: PointTuple;
	zoom?: number;
};

export function MapCanvas({
	class: className,
	children,
	interactive = true,
	osmTiles = true,
	attribution = true,
	center = DEFAULT_CENTER,
	zoom = DEFAULT_ZOOM,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [map, setMap] = useState<maplibregl.Map | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		containerRef.current.style.setProperty("--map-zoom", String(zoom));
		containerRef.current.style.setProperty("--map-zoom-anim", String(zoom));

		const osmSource: maplibregl.SourceSpecification = {
			type: "vector",
			url: `pmtiles://${osmTilesUrl}`,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
		};

		const m = new maplibregl.Map({
			container: containerRef.current,
			style: {
				version: 8,
				glyphs: "./fonts/{fontstack}/{range}.pbf",
				sources: osmTiles ? { osm: osmSource } : {},
				layers: osmTiles ? OSM_LAYERS : [],
			},
			center: [center[1], center[0]], // [lng, lat]
			zoom,
			maxBounds: MAX_BOUNDS,
			...(interactive && { minZoom: 14, maxZoom: 19 }),
			dragRotate: false,
			touchPitch: false,
			attributionControl: attribution,
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
			containerRef.current?.style.setProperty(
				"--map-zoom",
				String(m.getZoom()),
			);
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
