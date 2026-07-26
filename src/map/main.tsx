import { ScoutButton, ScoutInput } from "@scouterna/ui-react";
import ArrowLeftIcon from "@tabler/icons/outline/arrow-left.svg?raw";
import CheckIcon from "@tabler/icons/outline/check.svg?raw";
import PencilIcon from "@tabler/icons/outline/pencil.svg?raw";
import PlusIcon from "@tabler/icons/outline/plus.svg?raw";
import RouteIcon from "@tabler/icons/outline/route.svg?raw";
import SearchIcon from "@tabler/icons/outline/search.svg?raw";
import { TolgeeProvider, useTranslate } from "@tolgee/react";
import { AnimatePresence } from "motion/react";
import { render } from "preact";
import { memo } from "preact/compat";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { BaseLayers } from "../common/BaseLayers";
import { LocationsLayer } from "../common/layers/LocationsLayer";
import { OpeningPathsLayer } from "../common/layers/OpeningPathsLayer";
import {
	canManageActivities,
	getMe,
	getRawLocation,
	saveLocation,
} from "../common/locationAdminService";
import {
	getLocations,
	hasSwedishName,
	rawToLocation,
} from "../common/locationService";
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
import {
	BottomSheet,
	NEW_LOCATION_COLOR,
	NEW_LOCATION_ICON,
	NewLocationSheet,
} from "./BottomSheet";
import { MapInteraction } from "./MapInteraction";
import { ResultsPane } from "./ResultsPane";

// Swedish name of the pin that stays on the map in the opening-paths view.
// Matched against the raw sv name, so it holds in any UI language.
const MAIN_STAGE_NAME = "Stora Scenen";

// Id of the placeholder marker shown while a new location is being filled in.
// Never sent anywhere — it exists only so the drop point is visible on the map.
const DRAFT_LOCATION_ID = "__draft__";

type MapViewProps = {
	locations: Location[];
	selectedResult: SearchResult | null;
	onLocationClick: (loc: Location) => void;
	onMapClick: () => void;
	onResultClick: (result: SearchResult) => void;
	getSheetHeight: () => number;
	editMode: boolean;
	onLocationMove: (id: string, position: PointTuple) => void;
	showOpeningPaths: boolean;
	placing: boolean;
	onPlacePoint: (position: PointTuple) => void;
	draftPosition: PointTuple | null;
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
	showOpeningPaths,
	placing,
	onPlacePoint,
	draftPosition,
}: MapViewProps) {
	// The opening-paths view is about getting everyone to the main stage, so it
	// drops every other pin — the routes are the message, and a full pin field
	// just competes with them.
	const visibleLocations = useMemo(() => {
		const base = showOpeningPaths
			? locations.filter((loc) => hasSwedishName(loc, MAIN_STAGE_NAME))
			: locations;
		if (!draftPosition) return base;
		// The draft rides along as a normal marker so it can be dragged to fine-tune
		// the drop point before the location is created.
		const draft: Location = {
			id: DRAFT_LOCATION_ID,
			name: "",
			description: "",
			position: draftPosition,
			category: {
				iconName: NEW_LOCATION_ICON,
				iconVariant: "outline",
				color: NEW_LOCATION_COLOR,
			},
			tags: [],
		};
		return [...base, draft];
	}, [locations, showOpeningPaths, draftPosition]);

	// Keep the stage pin (and its label) out of the declutter logic — with the
	// other pins gone there is nothing for it to collide with anyway.
	const forceVisibleIds = useMemo(() => {
		const ids = showOpeningPaths
			? new Set(visibleLocations.map((l) => l.id))
			: selectedResult?.type === "group"
				? new Set(selectedResult.locations.map((l) => l.id))
				: null;
		// The draft pin must never declutter away — it's the thing being placed.
		if (!draftPosition) return ids;
		return new Set([...(ids ?? []), DRAFT_LOCATION_ID]);
	}, [showOpeningPaths, visibleLocations, selectedResult, draftPosition]);

	return (
		<MapCanvas class={`flex-1 z-10 ${placing ? "cursor-crosshair" : ""}`}>
			<BaseLayers />
			{showOpeningPaths && <OpeningPathsLayer />}
			<LocationsLayer
				locations={visibleLocations}
				onLocationClick={onLocationClick}
				editMode={editMode}
				onLocationMove={onLocationMove}
				activeId={
					selectedResult?.type === "location"
						? selectedResult.location.id
						: null
				}
				forceVisibleIds={forceVisibleIds}
			/>
			<MapInteraction
				selectedResult={selectedResult}
				getSheetHeight={getSheetHeight}
				onMapClick={onMapClick}
				onResultClick={onResultClick}
				onPlacePoint={placing ? onPlacePoint : undefined}
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
	const [showOpeningPaths, setShowOpeningPaths] = useState(false);
	// Unconfirmed pin drags, keyed by location id. The value is the last-saved
	// position, used for Undo. Nothing persists until the user confirms via the
	// move bar; multiple pins can be staged at once.
	const [pendingMoves, setPendingMoves] = useState<Map<string, PointTuple>>(
		new Map(),
	);
	// Add-location flow: `placing` waits for the map tap that drops the pin,
	// `draftPosition` then holds that point while the create form is filled in.
	const [placing, setPlacing] = useState(false);
	const [draftPosition, setDraftPosition] = useState<PointTuple | null>(null);

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

	const handleToggleEdit = useCallback(() => {
		setEditMode((v) => !v);
		// Leaving edit mode abandons any half-finished placement.
		setPlacing(false);
		setDraftPosition(null);
	}, []);

	const handleStartPlacing = useCallback(() => {
		setSelectedResult(null);
		setDraftPosition(null);
		setPlacing(true);
	}, []);

	const handlePlacePoint = useCallback((position: PointTuple) => {
		setPlacing(false);
		setDraftPosition(position);
	}, []);

	const handleCancelDraft = useCallback(() => {
		setPlacing(false);
		setDraftPosition(null);
	}, []);

	const handleToggleOpeningPaths = useCallback(
		() => setShowOpeningPaths((v) => !v),
		[],
	);

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

	// Drop a deleted location from the map and close its sheet. Any staged move
	// for it is discarded too — there's nothing left to save it onto.
	const handleLocationDeleted = useCallback((id: string) => {
		setLocations((prev) => prev.filter((l) => l.id !== id));
		setPendingMoves((prev) => {
			if (!prev.has(id)) return prev;
			const next = new Map(prev);
			next.delete(id);
			return next;
		});
		setSelectedResult((prev) =>
			prev?.type === "location" && prev.location.id === id ? null : prev,
		);
	}, []);

	// A drag only stages the new position (shown on the map) and adds it to the move
	// bar; it does not persist until the user confirms. `from` is captured once (the
	// first time a pin is staged) from the last-saved coordinates, so Undo can
	// restore them even after repeated drags of the same pin.
	const handleLocationMove = useCallback((id: string, position: PointTuple) => {
		// The draft pin isn't a saved location — dragging it just moves the drop
		// point, with nothing to stage or undo.
		if (id === DRAFT_LOCATION_ID) {
			setDraftPosition(position);
			return;
		}
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

	// Revert a single pin's staged move. Used when opening the edit form for a pin
	// that has an unsaved move — the form PUTs the last-saved coordinates, so the
	// move has to go one way or the other before editing.
	const handleDiscardMove = useCallback(
		(id: string) => {
			const from = pendingMoves.get(id);
			if (!from) return;
			setLocations((prev) =>
				prev.map((l) => (l.id === id ? { ...l, position: from } : l)),
			);
			setPendingMoves((prev) => {
				const next = new Map(prev);
				next.delete(id);
				return next;
			});
		},
		[pendingMoves],
	);

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
		// Tapping the draft pin keeps the create sheet open rather than opening the
		// detail sheet for a location that doesn't exist yet.
		if (loc.id === DRAFT_LOCATION_ID) return;
		setSelectedResult({ type: "location", location: loc });
		setSearchActive(false);
	}, []);

	// A created location joins the map and opens as the selected result, so it
	// behaves exactly like any other pin right after creation.
	const handleLocationCreated = useCallback(async (raw: RawLocation) => {
		const created = await rawToLocation(raw);
		setDraftPosition(null);
		setPlacing(false);
		setLocations((prev) => [...prev, created]);
		setSelectedResult({ type: "location", location: created });
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

			{/* Floating map controls. The parent shell's app bar doesn't support action
			    buttons (it only renders `title`), so these live in-map. */}
			<div class="fixed top-16 right-3 z-30 flex flex-col items-end gap-2">
				<ScoutButton
					variant={showOpeningPaths ? "primary" : "outlined"}
					icon={RouteIcon}
					iconPosition="before"
					className="shadow-md bg-white rounded-[14px] j26-rainbow-button"
					onClick={handleToggleOpeningPaths}
				>
					{showOpeningPaths ? t("openingPaths.hide") : t("openingPaths.show")}
				</ScoutButton>

				{/* Edit toggle for authorized users. Hidden while a move is being confirmed. */}
				{canEdit && pendingMoves.size === 0 && (
					<ScoutButton
						variant={editMode ? "primary" : "outlined"}
						icon={editMode ? CheckIcon : PencilIcon}
						iconOnly
						className="shadow-md bg-white rounded-[14px]"
						onClick={handleToggleEdit}
					>
						{editMode
							? t("edit.done", "Done editing")
							: t("edit.toggle", "Edit locations")}
					</ScoutButton>
				)}

				{/* Add a new location: arms placement, then a map tap drops the pin. */}
				{canEdit && editMode && pendingMoves.size === 0 && (
					<ScoutButton
						variant={placing ? "primary" : "outlined"}
						icon={PlusIcon}
						iconOnly
						className="shadow-md bg-white rounded-[14px]"
						onClick={placing ? handleCancelDraft : handleStartPlacing}
					>
						{placing
							? t("edit.addCancel", "Cancel adding location")
							: t("edit.add", "Add location")}
					</ScoutButton>
				)}
			</div>

			{/* Placement prompt — mirrors the move bar's position and styling. */}
			{placing && (
				<div class="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white rounded-full shadow-lg border border-gray-200 pl-4 pr-2 py-1.5">
					<span class="text-sm font-medium text-gray-700">
						{t("edit.addHint", "Tap the map to place the new location")}
					</span>
					<ScoutButton variant="text" onClick={handleCancelDraft}>
						{t("edit.cancel", "Cancel")}
					</ScoutButton>
				</div>
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
				{draftPosition && (
					<NewLocationSheet
						position={draftPosition}
						onCancel={handleCancelDraft}
						onCreated={handleLocationCreated}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{selectedResult && !draftPosition && (
					<BottomSheet
						result={selectedResult}
						onClose={handleSheetClose}
						onLocationClick={handleLocationClick}
						onHeightChange={handleSheetHeight}
						editMode={editMode && canEdit}
						hasPendingMove={
							selectedResult.type === "location" &&
							pendingMoves.has(selectedResult.location.id)
						}
						onDiscardMove={handleDiscardMove}
						onLocationUpdated={applyLocationUpdate}
						onLocationDeleted={handleLocationDeleted}
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
				showOpeningPaths={showOpeningPaths}
				placing={placing}
				onPlacePoint={handlePlacePoint}
				draftPosition={draftPosition}
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
