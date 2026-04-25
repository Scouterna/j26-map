import { ScoutButton, ScoutInput } from "@scouterna/ui-react";
import ArrowLeftIcon from "@tabler/icons/outline/arrow-left.svg?raw";
import SearchIcon from "@tabler/icons/outline/search.svg?raw";
import { AnimatePresence } from "motion/react";
import { render } from "preact";
import { memo } from "preact/compat";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { BaseLayers } from "../common/BaseLayers";
import { LocationsLayer } from "../common/layers/LocationsLayer";
import type { Location } from "../common/locationTypes";
import { MapCanvas } from "../common/MapCanvas";
import type { SearchResult } from "../common/searchTypes";
import { useAppBarTitle } from "../common/use-app-bar-title";
import "../style.css";
import { BottomSheet } from "./BottomSheet";
import { MapInteraction } from "./MapInteraction";
import { ResultsPane } from "./ResultsPane";

type MapViewProps = {
	selectedResult: SearchResult | null;
	onLocationClick: (loc: Location) => void;
	getSheetHeight: () => number;
};

const MapView = memo(function MapView({
	selectedResult,
	onLocationClick,
	getSheetHeight,
}: MapViewProps) {
	const visibleIds = useMemo(() => {
		if (selectedResult?.type === "location")
			return new Set([selectedResult.location.id]);
		if (selectedResult?.type === "group")
			return new Set(selectedResult.locations.map((l) => l.id));
		return null;
	}, [selectedResult]);

	return (
		<MapCanvas class="flex-1 z-10">
			<BaseLayers />
			<LocationsLayer
				onLocationClick={onLocationClick}
				visibleIds={visibleIds}
			/>
			<MapInteraction
				selectedResult={selectedResult}
				getSheetHeight={getSheetHeight}
			/>
		</MapCanvas>
	);
});

function MapApp() {
	useAppBarTitle("Karta");

	const [searchActive, setSearchActive] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
		null,
	);
	const sheetHeightRef = useRef(0);
	const handleSheetHeight = useCallback((h: number) => {
		sheetHeightRef.current = h;
	}, []);
	const getSheetHeight = useCallback(() => sheetHeightRef.current, []);

	const handleResultClick = useCallback((result: SearchResult) => {
		setSelectedResult(result);
		setSearchActive(false);
	}, []);

	const handleLocationClick = useCallback((loc: Location) => {
		setSelectedResult({ type: "location", location: loc });
		setSearchActive(false);
	}, []);

	const handleSheetClose = useCallback(() => {
		setSelectedResult(null);
	}, []);

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
				{searchActive && (
					<ResultsPane
						searchValue={searchValue}
						onResultClick={handleResultClick}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{selectedResult && (
					<BottomSheet
						result={selectedResult}
						onClose={handleSheetClose}
						onLocationClick={handleLocationClick}
						onHeightChange={handleSheetHeight}
					/>
				)}
			</AnimatePresence>

			<MapView
				selectedResult={selectedResult}
				onLocationClick={handleLocationClick}
				getSheetHeight={getSheetHeight}
			/>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<MapApp />, document.getElementById("app")!);
