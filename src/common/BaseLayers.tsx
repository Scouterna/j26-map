import { GeoJsonLayer } from "./layers/GeoJsonLayer";

export function BaseLayers() {
	return (
		<>
			<GeoJsonLayer
				src="./layers/area_covers.geojson"
				style={{ color: "transparent", fillColor: "#cdebb0", fillOpacity: 1 }}
			/>
			<GeoJsonLayer
				src="./layers/roads.geojson"
				style={{ color: "#b3b3b3", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
				weightOffset={2}
			/>
			<GeoJsonLayer
				src="./layers/roads.geojson"
				style={{ color: "#ffffff", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
			/>
		</>
	);
}
