import { ScoutButton, ScoutInput } from "@scouterna/ui-react";
import ArrowLeftIcon from "@tabler/icons/outline/arrow-left.svg?raw";
import SearchIcon from "@tabler/icons/outline/search.svg?raw";
import { render } from "preact";
import { memo } from "preact/compat";
import { BaseLayers } from "../common/BaseLayers";
import { LocationsLayer } from "../common/layers/LocationsLayer";
import { MapCanvas } from "../common/MapCanvas";
import { useAppBarTitle } from "../common/use-app-bar-title";
import "../style.css";
import { AnimatePresence } from "motion/react";
import { useState } from "preact/hooks";
import { ResultsPane } from "./ResultsPane";

const MapView = memo(function MapView() {
	return (
		<MapCanvas class="flex-1 z-10">
			<BaseLayers />
			<LocationsLayer />
		</MapCanvas>
	);
});

function MapApp() {
	useAppBarTitle("Karta");

	const [searchActive, setSearchActive] = useState(false);
	const [searchValue, setSearchValue] = useState("");

	return (
		<div class="w-screen h-dvh flex flex-col">
			<div
				class={`
					p-2 flex items-center bg-white border-b border-gray-200 shadow-md z-40
					${searchActive ? "shadow-none border-transparent" : ""}
				`}
			>
				<ScoutButton
					variant="text"
					icon={ArrowLeftIcon}
					iconOnly
					className={`
						-ml-1 mr-1 transition-[width] w-0
						${searchActive ? "w-11" : ""}
					`}
					onClick={() => setSearchActive(false)}
				>
					Tillbaka
				</ScoutButton>
				<ScoutInput
					className="flex-1"
					placeholder="Sök efter platser, områden, kårer..."
					icon={SearchIcon}
					clearable
					onFocus={() => setSearchActive(true)}
					onScoutInputChange={(e) => setSearchValue(e.detail.value)}
				/>
			</div>

			<AnimatePresence>
				{searchActive && <ResultsPane searchValue={searchValue} />}
			</AnimatePresence>

			<MapView />
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<MapApp />, document.getElementById("app")!);
