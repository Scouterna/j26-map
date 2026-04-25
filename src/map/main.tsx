import { render } from "preact";
import { BaseLayers } from "../common/BaseLayers";
import { LocationsLayer } from "../common/layers/LocationsLayer";
import { MapCanvas } from "../common/MapCanvas";
import { useAppBarTitle } from "../common/use-app-bar-title";
import "../style.css";
import { ScoutButton, ScoutInput } from "@scouterna/ui-react";
import XIcon from "@tabler/icons/outline/x.svg?raw";

function MapApp() {
	useAppBarTitle("Karta");

	return (
		<div class="w-screen h-dvh flex flex-col">
			<div class="p-2 flex gap-2 items-center bg-white border-b border-gray-200 shadow-md">
				<ScoutInput
					class="flex-1"
					placeholder="Söker efter platser, områden, aktiviteter..."
				/>
				<ScoutButton variant="text" icon={XIcon} iconOnly />
			</div>

			<MapCanvas class="flex-1">
				<BaseLayers />
				<LocationsLayer />
			</MapCanvas>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<MapApp />, document.getElementById("app")!);
