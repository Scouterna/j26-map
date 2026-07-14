import { memo } from "preact/compat";
import { AreaLabelsLayer } from "./layers/AreaLabelsLayer";
import { GeoJsonLayer } from "./layers/GeoJsonLayer";
import { RoadLabelsLayer } from "./layers/RoadLabelsLayer";
import { VillageLabelsLayer } from "./layers/VillageLabelsLayer";
import { layerUrl } from "./mapLayers";

export const BaseLayers = memo(function BaseLayers() {
	return (
		<>
			<AreaLabelsLayer />
			<VillageLabelsLayer />
			<GeoJsonLayer
				id="outline"
				src={layerUrl("outline")}
				style={{ color: "transparent", fillColor: "#c8dfae", fillOpacity: 1 }}
			/>
			<GeoJsonLayer
				id="forest"
				src={layerUrl("forest")}
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
				src={layerUrl("village_blocks")}
				style={{
					color: "transparent",
					fillOpacity: ["interpolate", ["linear"], ["zoom"], 16, 1, 16.3, 0],
				}}
				fillColorAttribute="color"
			/>
			<GeoJsonLayer
				id="villages"
				src={layerUrl("villages")}
				style={{
					color: "transparent",
					fillOpacity: ["interpolate", ["linear"], ["zoom"], 15.7, 0, 16, 1],
				}}
				fillColorAttribute="color"
			/>
			<GeoJsonLayer
				id="roads-outline"
				src={layerUrl("roads")}
				style={{ color: "#b3b3b3", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
				weightOffset={2}
			/>
			<GeoJsonLayer
				id="roads-fill"
				src={layerUrl("roads")}
				style={{ color: "#ffffff", weight: 5, opacity: 1, lineCap: "butt" }}
				geoScale
				weightAttribute="width"
			/>
			<RoadLabelsLayer />
			<GeoJsonLayer
				id="tents"
				src={layerUrl("tents")}
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
