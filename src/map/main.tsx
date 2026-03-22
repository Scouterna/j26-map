import { render } from "preact";
import { GeoJsonLayer } from "../common/layers/GeoJsonLayer";
import { MapCanvas } from "../common/MapCanvas";
import "../style.css";

function MapApp() {
	return (
		<div class="w-screen h-dvh">
			<MapCanvas>
				{/* Event area base */}
				<GeoJsonLayer
					src="/layers/area_covers.geojson"
					style={{ color: "transparent", fillColor: "#cdebb0", fillOpacity: 1 }}
				/>
				{/* Road casing (border) */}
				<GeoJsonLayer
					src="/layers/roads.geojson"
					style={{ color: "#b3b3b3", weight: 5, opacity: 1, lineCap: "butt" }}
					geoScale
					weightAttribute="width"
					weightOffset={2}
				/>
				{/* Road fill */}
				<GeoJsonLayer
					src="/layers/roads.geojson"
					style={{ color: "#ffffff", weight: 5, opacity: 1, lineCap: "butt" }}
					geoScale
					weightAttribute="width"
				/>
			</MapCanvas>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<MapApp />, document.getElementById("app")!);
