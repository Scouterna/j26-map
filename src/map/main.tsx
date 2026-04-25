import { render } from "preact";
import { BaseLayers } from "../common/BaseLayers";
import { LocationsLayer } from "../common/layers/LocationsLayer";
import { MapCanvas } from "../common/MapCanvas";
import { useAppBarTitle } from "../common/use-app-bar-title";
import "../style.css";

function MapApp() {
	useAppBarTitle("Karta");

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
