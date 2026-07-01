import type maplibregl from "maplibre-gl";
import type { SymbolLayerSpecification } from "maplibre-gl";
import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

const SRC_ID = "road-labels-src";
const LAYER_ID = "road-labels";

export function RoadLabelsLayer() {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		map.addSource(SRC_ID, { type: "geojson", data: EMPTY_FC });

		const spec: SymbolLayerSpecification = {
			id: LAYER_ID,
			type: "symbol",
			source: SRC_ID,
			filter: ["has", "name"],
			layout: {
				"symbol-placement": "line",
				"text-field": ["get", "name"],
				"text-font": ["Klokantech Noto Sans Regular"],
				"text-size": ["interpolate", ["linear"], ["zoom"], 14, 9, 17, 11, 19, 14],
				"text-max-angle": 30,
				"symbol-spacing": 300,
				"text-padding": 10,
			},
			paint: {
				"text-color": "#555555",
				"text-halo-color": "rgba(255,255,255,0.85)",
				"text-halo-width": 2,
			},
		};

		map.addLayer(spec);

		let cancelled = false;
		fetch("./layers/roads.geojson")
			.then((r) => r.json())
			.then((data) => {
				if (cancelled) return;
				(map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(data);
			});

		return () => {
			cancelled = true;
			if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
			if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
		};
	}, [map]);

	return null;
}
