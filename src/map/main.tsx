import { ScoutButton, ScoutInput } from "@scouterna/ui-react";
import ArrowLeftIcon from "@tabler/icons/outline/arrow-left.svg?raw";
import CheckIcon from "@tabler/icons/outline/check.svg?raw";
import PencilIcon from "@tabler/icons/outline/pencil.svg?raw";
import SearchIcon from "@tabler/icons/outline/search.svg?raw";
import { TolgeeProvider, useTranslate } from "@tolgee/react";
import { AnimatePresence } from "motion/react";
import { render } from "preact";
import { memo } from "preact/compat";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { BaseLayers } from "../common/BaseLayers";
import { LocationsLayer } from "../common/layers/LocationsLayer";
import {
	canManageActivities,
	getMe,
	getRawLocation,
	saveLocation,
} from "../common/locationAdminService";
import { getLocations, rawToLocation } from "../common/locationService";
import type {
	Location,
	PointTuple,
	RawLocation,
} from "../common/locationTypes";
import { MapCanvas } from "../common/MapCanvas";
import type { SearchResult } from "../common/searchTypes";
import { tolgee } from "../common/tolgee";
import { useAppBarTitle } from "../common/use-app-bar-title";
import "../style.css";
import { BottomSheet } from "./BottomSheet";
import { MapInteraction } from "./MapInteraction";
import { ResultsPane } from "./ResultsPane";

type MapViewProps = {
	locations: Location[];
	selectedResult: SearchResult | null;
	onLocationClick: (loc: Location) => void;
	onMapClick: () => void;
	onResultClick: (result: SearchResult) => void;
	getSheetHeight: () => number;
	editMode: boolean;
	onLocationMove: (id: string, position: PointTuple) => void;
};

const MapView = memo(function MapView({
	locations,
	selectedResult,
	onLocationClick,
	onMapClick,
	onResultClick,
	getSheetHeight,
	editMode,
	onLocationMove,
}: MapViewProps) {
	return (
		<MapCanvas class="flex-1 z-10">
			<BaseLayers />
			<LocationsLayer
				locations={locations}
				onLocationClick={onLocationClick}
				editMode={editMode}
				onLocationMove={onLocationMove}
				activeId={
					selectedResult?.type === "location"
						? selectedResult.location.id
						: null
				}
				forceVisibleIds={
					selectedResult?.type === "group"
						? new Set(selectedResult.locations.map((l) => l.id))
						: null
				}
			/>
			<MapInteraction
				selectedResult={selectedResult}
				getSheetHeight={getSheetHeight}
				onMapClick={onMapClick}
				onResultClick={onResultClick}
			/>
		</MapCanvas>
	);
});

function MapApp() {
	const { t } = useTranslate("map");

	const [searchActive, setSearchActive] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
		null,
	);
	const [locations, setLocations] = useState<Location[]>([]);
	const [canEdit, setCanEdit] = useState(false);
	const [editMode, setEditMode] = useState(false);
	// Unconfirmed pin drags, keyed by location id. The value is the last-saved
	// position, used for Undo. Nothing persists until the user confirms via the
	// move bar; multiple pins can be staged at once.
	const [pendingMoves, setPendingMoves] = useState<Map<string, PointTuple>>(
		new Map(),
	);

	useEffect(() => {
		getLocations().then(setLocations);
	}, []);

	// Gate the edit UI on the booking role. The server enforces it independently.
	useEffect(() => {
		getMe().then((me) => {
			if (me && canManageActivities(me.roles)) setCanEdit(true);
		});
	}, []);

	useAppBarTitle(t("appBar.title"));

	const handleToggleEdit = useCallback(() => setEditMode((v) => !v), []);

	// Re-project a raw location returned by a write and merge it into local state,
	// keeping the map markers and any open sheet in sync.
	const applyLocationUpdate = useCallback(async (raw: RawLocation) => {
		const updated = await rawToLocation(raw);
		setLocations((prev) =>
			prev.map((l) => (l.id === updated.id ? updated : l)),
		);
		setSelectedResult((prev) =>
			prev?.type === "location" && prev.location.id === updated.id
				? { type: "location", location: updated }
				: prev,
		);
	}, []);

	// A drag only stages the new position (shown on the map) and adds it to the move
	// bar; it does not persist until the user confirms. `from` is captured once (the
	// first time a pin is staged) from the last-saved coordinates, so Undo can
	// restore them even after repeated drags of the same pin.
	const handleLocationMove = useCallback((id: string, position: PointTuple) => {
		setLocations((prev) =>
			prev.map((l) => (l.id === id ? { ...l, position } : l)),
		);
		setPendingMoves((prev) => {
			if (prev.has(id)) return prev;
			const raw = getRawLocation(id);
			const from: PointTuple =
				raw?.latitude != null && raw?.longitude != null
					? [raw.latitude, raw.longitude]
					: position;
			const next = new Map(prev);
			next.set(id, from);
			return next;
		});
	}, []);

	// Revert all staged moves to their last-saved positions and clear the move bar.
	const handleUndoMoves = useCallback(() => {
		setLocations((prev) =>
			prev.map((l) => {
				const from = pendingMoves.get(l.id);
				return from ? { ...l, position: from } : l;
			}),
		);
		setPendingMoves(new Map());
	}, [pendingMoves]);

	// Persist every staged position; reconcile each with the server on success and
	// revert individually on failure so the map never shows an unsaved position.
	const handleConfirmMoves = useCallback(() => {
		if (pendingMoves.size === 0) return;
		const moves = [...pendingMoves.entries()];
		setPendingMoves(new Map());
		Promise.allSettled(
			moves.map(([id, from]) => {
				const loc = locations.find((l) => l.id === id);
				if (!loc) return Promise.resolve();
				return saveLocation(id, {
					latitude: loc.position[0],
					longitude: loc.position[1],
				})
					.then(applyLocationUpdate)
					.catch((err) => {
						setLocations((prev) =>
							prev.map((l) => (l.id === id ? { ...l, position: from } : l)),
						);
						throw err;
					});
			}),
		).then((results) => {
			if (results.some((r) => r.status === "rejected")) {
				alert(t("edit.error", "Could not save changes. Please try again."));
			}
		});
	}, [pendingMoves, locations, applyLocationUpdate, t]);

	const sheetHeightRef = useRef(0);
	const handleSheetHeight = useCallback((h: number) => {
		sheetHeightRef.current = h;
	}, []);
	const getSheetHeight = useCallback(() => sheetHeightRef.current, []);

	// Push a history entry when search opens so the Android back button closes it.
	// When search closes via UI, consume that entry with history.back().
	useEffect(() => {
		if (searchActive) {
			history.pushState({ searchOpen: true }, "");
		} else if (history.state?.searchOpen) {
			history.back();
		}
	}, [searchActive]);

	useEffect(() => {
		const handlePopState = () => setSearchActive(false);
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const handleResultClick = useCallback((result: SearchResult) => {
		// Scout group results navigate to their village
		setSelectedResult(result.type === "scout-group" ? result.village : result);
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
					{t("search.back")}
				</ScoutButton>
				<ScoutInput
					className="flex-1"
					placeholder={t("search.placeholder")}
					icon={SearchIcon}
					clearable
					onFocus={() => setSearchActive(true)}
					onScoutInputChange={(e) => setSearchValue(e.detail.value)}
				/>
			</div>

			{/* Edit toggle for authorized users. The parent shell's app bar doesn't
			    support action buttons (it only renders `title`), so the control lives
			    in-map as a floating button. Hidden while a move is being confirmed. */}
			{canEdit && pendingMoves.size === 0 && (
				<ScoutButton
					variant={editMode ? "primary" : "outlined"}
					icon={editMode ? CheckIcon : PencilIcon}
					iconOnly
					className="fixed top-16 right-3 z-30 shadow-md bg-white rounded-[14px]"
					onClick={handleToggleEdit}
				>
					{editMode
						? t("edit.done", "Done editing")
						: t("edit.toggle", "Edit locations")}
				</ScoutButton>
			)}

			{/* Confirm bar for staged pin moves — nothing persists until Save. You can
			    drag several pins first; Save/Undo apply to all staged moves. */}
			{pendingMoves.size > 0 && (
				<div class="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white rounded-full shadow-lg border border-gray-200 pl-4 pr-2 py-1.5">
					<span class="text-sm font-medium text-gray-700">
						{t("edit.moveConfirmMany", "{count} pins moved", {
							count: pendingMoves.size,
						})}
					</span>
					<ScoutButton variant="text" onClick={handleUndoMoves}>
						{t("edit.undo", "Undo")}
					</ScoutButton>
					<ScoutButton variant="primary" onClick={handleConfirmMoves}>
						{t("edit.save", "Save")}
					</ScoutButton>
				</div>
			)}

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
						editMode={editMode && canEdit}
						onLocationUpdated={applyLocationUpdate}
					/>
				)}
			</AnimatePresence>

			<MapView
				locations={locations}
				selectedResult={selectedResult}
				onLocationClick={handleLocationClick}
				onMapClick={handleSheetClose}
				onResultClick={handleResultClick}
				getSheetHeight={getSheetHeight}
				editMode={editMode && canEdit}
				onLocationMove={handleLocationMove}
			/>
		</div>
	);
}

const appElement =
	// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
	document.getElementById("app")!;

render(
	<TolgeeProvider tolgee={tolgee} options={{ useSuspense: false }}>
		<MapApp />
	</TolgeeProvider>,
	appElement,
);
