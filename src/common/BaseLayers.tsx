import { memo } from "preact/compat";
import { AreaLabelsLayer } from "./layers/AreaLabelsLayer";
import { GeoJsonLayer } from "./layers/GeoJsonLayer";
import { RoadLabelsLayer } from "./layers/RoadLabelsLayer";
import { VillageLabelsLayer } from "./layers/VillageLabelsLayer";

export const BaseLayers = memo(function BaseLayers() {
	return (
		<>
			<AreaLabelsLayer />
			<VillageLabelsLayer />
			<GeoJsonLayer
				id="outline"
				src="./layers/outline.geojson"
				style={{ color: "transparent", fillColor: "#cdebb0", fillOpacity: 1 }}
			/>
			<GeoJsonLayer
				id="forest"
				src="./layers/forest.geojson"
				style={{
					color: "transparent",
					fillColor: "url(#forest-texture)",
					fillOpacity: 1,
				}}
				patternDef={`
					<pattern id="forest-texture" patternUnits="userSpaceOnUse" width="256" height="256">
						<rect width="256" height="256" fill="#add19e"/>
						<image href="./symbols/leaftype_unknown.svg" width="256" height="256" opacity="0.5"/>
					</pattern>
				`}
			/>
			<GeoJsonLayer
				id="villages"
				src="./layers/villages.geojson"
				style={{
					color: "#c8a870",
					weight: 1,
					fillColor: "#f0e6d0",
					fillOpacity: 0.5,
					fill: true,
				}}
			/>
			<GeoJsonLayer
				id="districts-fill"
				src="./layers/districts.geojson"
				style={{
					color: "transparent",
					weight: 0,
					fillOpacity: ["interpolate", ["linear"], ["zoom"], 16, 0.2, 16.5, 0],
				}}
				fillColorAttribute="color"
			/>
			<GeoJsonLayer
				id="districts-border"
				src="./layers/districts.geojson"
				style={{ weight: 4, fillOpacity: 0, opacity: 0.6 }}
				colorAttribute="color"
			/>
			<GeoJsonLayer
				id="roads-outline"
				src="./layers/roads.geojson"
				style={{ color: "#b3b3b3", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
				weightOffset={2}
			/>
			<GeoJsonLayer
				id="roads-fill"
				src="./layers/roads.geojson"
				style={{ color: "#ffffff", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
			/>
			<RoadLabelsLayer />
			<GeoJsonLayer
				id="tents"
				src="./layers/tents.geojson"
				style={{
					color: "#b8a898",
					weight: 1,
					fillColor: "#d9cfc7",
					fillOpacity: 1,
				}}
			/>
		</>
	);
});
