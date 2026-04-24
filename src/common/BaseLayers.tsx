import { GeoJsonLayer } from "./layers/GeoJsonLayer";
import { MapPane } from "./layers/MapPane";

export function BaseLayers() {
	return (
		<>
			<MapPane name="baseFill" zIndex={300} />
			<GeoJsonLayer
				src="./layers/outline.geojson"
				style={{ color: "transparent", fillColor: "#cdebb0", fillOpacity: 1 }}
				svgPadding={1}
				pane="baseFill"
			/>
			<GeoJsonLayer
				src="./layers/forest.geojson"
				style={{
					color: "transparent",
					fillColor: "url(#forest-texture)",
					fillOpacity: 1,
				}}
				svgPadding={1}
				pane="baseFill"
				patternDef={`
					<pattern id="forest-texture" patternUnits="userSpaceOnUse" width="256" height="256">
						<rect width="256" height="256" fill="#add19e"/>
						<image href="./symbols/leaftype_unknown.svg" width="256" height="256" opacity="0.5"/>
					</pattern>
				`}
			/>
			<GeoJsonLayer // Roads gray outline
				src="./layers/roads.geojson"
				style={{ color: "#b3b3b3", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
				weightOffset={2}
			/>
			<GeoJsonLayer // Roads white fill
				src="./layers/roads.geojson"
				style={{ color: "#ffffff", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
			/>
			<GeoJsonLayer
				src="./layers/tents.geojson"
				style={{
					color: "#b8a898",
					weight: 1,
					fillColor: "#d9cfc7",
					fillOpacity: 1,
				}}
				useCanvas
			/>
		</>
	);
}
