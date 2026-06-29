import maplibregl from "maplibre-gl";
import { useEffect, useState } from "preact/hooks";
import type { PointTuple } from "../locationTypes";
import { useMap } from "../MapCanvas";

type LabelFeature = {
	properties: { village_number: string };
	geometry: { type: "Point"; coordinates: [number, number] };
};

function createNumberElement(number: string): HTMLElement {
	const el = document.createElement("div");
	// j26-zoom-show-18 class (style.css) provides zoom-based opacity via --map-zoom-anim.
	// This element is the INNER content; the outer wrapper is what MapLibre controls (opacity always 1).
	el.className = "j26-zoom-show-16-5";
	el.style.cssText = `
		font-size: 11px;
		font-weight: 600;
		color: #8a6a3a;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
		z-index: 325;
	`;
	el.textContent = number;
	return el;
}

export function VillageLabelsLayer() {
	const map = useMap();
	const [labels, setLabels] = useState<
		{ number: string; position: PointTuple }[]
	>([]);

	useEffect(() => {
		fetch("./layers/village_labels.geojson")
			.then((r) => r.json())
			.then((geojson: { features: LabelFeature[] }) => {
				setLabels(
					geojson.features.map((f) => ({
						number: f.properties.village_number,
						// GeoJSON is [lng, lat], our PointTuple is [lat, lng]
						position: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
					})),
				);
			});
	}, []);

	useEffect(() => {
		if (!map || labels.length === 0) return;

		const markers = labels.map(({ number, position }) => {
			// Inner element carries the zoom class; MapLibre's _updateOpacity sets opacity on the
			// outer wrapper only, so the inner zoom-class opacity is not overridden.
			const inner = createNumberElement(number);
			const outer = document.createElement("div");
			outer.style.cssText = "display:inline-block;pointer-events:none";
			outer.appendChild(inner);
			return new maplibregl.Marker({ element: outer, anchor: "center" })
				.setLngLat([position[1], position[0]])
				.addTo(map);
		});

		return () => {
			for (const m of markers) m.remove();
		};
	}, [map, labels]);

	return null;
}
