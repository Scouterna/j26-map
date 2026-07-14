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
				style={{ color: "transparent", fillColor: "#c8dfae", fillOpacity: 1 }}
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
			{/* Zoomed out: merged district blocks (padding hidden, less cluttered).
			    Zoomed in: individual rounded village tiles. The blobs (bottom layer)
			    stay fully opaque while the tiles fade in on top, then fade out only
			    once the tiles are opaque — so an opaque layer always covers the area
			    and the background never bleeds through during the crossfade. */}
			<GeoJsonLayer
				id="village-blocks"
				src="./layers/village_blocks.geojson"
				style={{
					color: "transparent",
					fillOpacity: ["interpolate", ["linear"], ["zoom"], 16, 1, 16.3, 0],
				}}
				fillColorAttribute="color"
			/>
			<GeoJsonLayer
				id="villages"
				src="./layers/villages.geojson"
				style={{
					color: "transparent",
					fillOpacity: ["interpolate", ["linear"], ["zoom"], 15.7, 0, 16, 1],
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
