import { render } from "preact";
import { BaseLayers } from "../common/BaseLayers";
import { LocationsLayer } from "../common/layers/LocationsLayer";
import { MapCanvas } from "../common/MapCanvas";
import "../style.css";

function MapApp() {
	return (
		<div class="w-screen h-dvh">
			<MapCanvas>
				<BaseLayers />
				<LocationsLayer />
			</MapCanvas>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<MapApp />, document.getElementById("app")!);
