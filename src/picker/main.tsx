import { render } from "preact";
import { MapCanvas } from "../common/MapCanvas";
import "../style.css";

function PickerApp() {
	return (
		<div class="w-screen h-dvh">
			<MapCanvas />
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<PickerApp />, document.getElementById("app")!);
