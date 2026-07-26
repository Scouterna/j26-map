import { ScoutButton } from "@scouterna/ui-react";
import PencilIcon from "@tabler/icons/outline/pencil.svg?raw";
import XIcon from "@tabler/icons/outline/x.svg?raw";
import { useTranslate } from "@tolgee/react";
import { motion, useAnimation, useMotionValue } from "motion/react";
import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { getIconURL } from "../common/icons";
import {
	createLocation,
	deleteLocation,
	getRawLocation,
	saveLocation,
} from "../common/locationAdminService";
import {
	getLocationTagNames,
	getLocationTags,
	type LocationTag,
} from "../common/locationTagService";
import type {
	Location,
	OpeningHourSlot,
	PointTuple,
	RawLocation,
} from "../common/locationTypes";
import { getGroupsForVillage } from "../common/scoutGroupService";
import type { SearchResult } from "../common/searchTypes";

const TODAY = new Date().toISOString().slice(0, 10);

type Props = {
	result: SearchResult;
	onClose: () => void;
	onLocationClick: (loc: Location) => void;
	onHeightChange: (height: number) => void;
	editMode?: boolean;
	// True when this location has an unsaved drag staged in the move bar. The edit
	// form writes the last-saved coordinates, so the move can't survive a save —
	// starting an edit asks to discard it first.
	hasPendingMove?: boolean;
	onDiscardMove?: (id: string) => void;
	onLocationUpdated?: (raw: RawLocation) => void;
	onLocationDeleted?: (id: string) => void;
};

function SheetIcon({
	iconName,
	variant = "outline",
	size = 24,
}: {
	iconName: string;
	variant?: "outline" | "filled";
	size?: number;
}) {
	return (
		<img
			src={getIconURL(iconName, variant)}
			width={size}
			height={size}
			class="shrink-0 opacity-80"
			alt=""
		/>
	);
}

function AccentStrip({ color }: { color: string }) {
	return (
		<div
			class="rounded-t-2xl h-1.5 w-full"
			style={{ backgroundColor: color }}
		/>
	);
}

function OpeningHours({ slots }: { slots: OpeningHourSlot[] }) {
	const { t } = useTranslate("map");
	const text = slots.map((s) => `${s.from}–${s.to}`).join(", ");
	return (
		<div class="flex items-center gap-1.5 px-4 pb-2 text-sm text-gray-500">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="shrink-0"
			>
				<circle cx="12" cy="12" r="10" />
				<polyline points="12 6 12 12 16 14" />
			</svg>
			<span>{t("bottomSheet.openingHours", { hours: text })}</span>
		</div>
	);
}

function LocationBody({ location }: { location: Location }) {
	const [tagNames, setTagNames] = useState<Map<string, string> | null>(null);

	useEffect(() => {
		getLocationTagNames().then(setTagNames);
	}, []);

	const tagLabels = (
		tagNames ? location.tags.map((t) => tagNames.get(t)) : []
	).filter((label): label is string => !!label);
	const todayHours = location.openingHours?.[TODAY];

	return (
		<div class="pb-2">
			{todayHours && <OpeningHours slots={todayHours} />}
			{tagLabels.length > 0 && (
				<div class="flex flex-wrap gap-2 px-4 pb-3">
					{tagLabels.map((label) => (
						<span
							key={label}
							class="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600"
						>
							{label}
						</span>
					))}
				</div>
			)}
			{!todayHours && tagLabels.length === 0 && <div class="h-4" />}
		</div>
	);
}

const FIELD_CLASS =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const LABEL_CLASS =
	"block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

// The fields the map's location form edits. `opening_hours` is deliberately
// absent — the map never touches it (writes preserve it via the raw cache).
type LocationFormValues = {
	name: { sv: string; en: string };
	description: { sv: string; en: string };
	icon_name: string;
	icon_variant: "outline" | "filled";
	color: string;
	tags: string[];
};

// Shared by the edit and create flows: identical fields, different submit.
// `onSubmit` performs the write (PUT or POST) and resolves with the server's
// raw location, which the caller merges into app state.
function LocationForm({
	initial,
	onCancel,
	onSubmit,
	onSaved,
	footer,
}: {
	initial: LocationFormValues;
	onCancel: () => void;
	onSubmit: (values: LocationFormValues) => Promise<RawLocation>;
	onSaved: (raw: RawLocation) => void;
	// Rendered inside the scroll area below the Save row — the edit flow puts
	// its delete affordance here, well away from the primary actions.
	footer?: ComponentChildren;
}) {
	const { t } = useTranslate("map");

	const [nameSv, setNameSv] = useState(initial.name.sv);
	const [nameEn, setNameEn] = useState(initial.name.en);
	const [descSv, setDescSv] = useState(initial.description.sv);
	const [descEn, setDescEn] = useState(initial.description.en);
	const [iconName, setIconName] = useState(initial.icon_name);
	const [iconVariant, setIconVariant] = useState<"outline" | "filled">(
		initial.icon_variant,
	);
	const [color, setColor] = useState(initial.color);
	const [tags, setTags] = useState<string[]>(initial.tags);

	const [allTags, setAllTags] = useState<LocationTag[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getLocationTags().then(setAllTags);
	}, []);

	const toggleTag = (id: string) => {
		setTags((prev) =>
			prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
		);
	};

	const handleSave = () => {
		if (saving) return;
		setSaving(true);
		setError(null);
		onSubmit({
			name: { sv: nameSv, en: nameEn },
			description: { sv: descSv, en: descEn },
			icon_name: iconName,
			icon_variant: iconVariant,
			color,
			tags,
		})
			.then((updated) => {
				setSaving(false);
				onSaved(updated);
			})
			.catch(() => {
				setSaving(false);
				setError(t("edit.error", "Could not save changes. Please try again."));
			});
	};

	return (
		<div class="px-4 pb-4 max-h-[60vh] overflow-y-auto space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class={LABEL_CLASS} for="edit-name-sv">
						{t("edit.nameSv", "Name (Swedish)")}
					</label>
					<input
						id="edit-name-sv"
						class={FIELD_CLASS}
						value={nameSv}
						onInput={(e) => setNameSv((e.target as HTMLInputElement).value)}
					/>
				</div>
				<div>
					<label class={LABEL_CLASS} for="edit-name-en">
						{t("edit.nameEn", "Name (English)")}
					</label>
					<input
						id="edit-name-en"
						class={FIELD_CLASS}
						value={nameEn}
						onInput={(e) => setNameEn((e.target as HTMLInputElement).value)}
					/>
				</div>
			</div>

			<div>
				<label class={LABEL_CLASS} for="edit-desc-sv">
					{t("edit.descriptionSv", "Description (Swedish)")}
				</label>
				<textarea
					id="edit-desc-sv"
					class={FIELD_CLASS}
					rows={2}
					value={descSv}
					onInput={(e) => setDescSv((e.target as HTMLTextAreaElement).value)}
				/>
			</div>
			<div>
				<label class={LABEL_CLASS} for="edit-desc-en">
					{t("edit.descriptionEn", "Description (English)")}
				</label>
				<textarea
					id="edit-desc-en"
					class={FIELD_CLASS}
					rows={2}
					value={descEn}
					onInput={(e) => setDescEn((e.target as HTMLTextAreaElement).value)}
				/>
			</div>

			<div class="flex items-end gap-3">
				<div class="flex-1">
					<label class={LABEL_CLASS} for="edit-icon">
						{t("edit.icon", "Icon")}
					</label>
					<input
						id="edit-icon"
						class={FIELD_CLASS}
						value={iconName}
						placeholder="tabler-tent"
						onInput={(e) => setIconName((e.target as HTMLInputElement).value)}
					/>
				</div>
				<select
					class={FIELD_CLASS}
					style={{ width: "auto" }}
					value={iconVariant}
					onChange={(e) =>
						setIconVariant(
							(e.target as HTMLSelectElement).value as "outline" | "filled",
						)
					}
				>
					<option value="outline">{t("edit.outline", "Outline")}</option>
					<option value="filled">{t("edit.filled", "Filled")}</option>
				</select>
				<div
					class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
					style={{ backgroundColor: `${color}20` }}
				>
					<img
						src={getIconURL(iconName, iconVariant)}
						width={22}
						height={22}
						class="opacity-80"
						alt=""
					/>
				</div>
			</div>

			<div>
				<label class={LABEL_CLASS} for="edit-color">
					{t("edit.color", "Color")}
				</label>
				<div class="flex items-center gap-2">
					<input
						id="edit-color"
						type="color"
						class="h-9 w-12 rounded border border-gray-300 p-0.5"
						value={color}
						onInput={(e) => setColor((e.target as HTMLInputElement).value)}
					/>
					<input
						class={FIELD_CLASS}
						value={color}
						onInput={(e) => setColor((e.target as HTMLInputElement).value)}
					/>
				</div>
			</div>

			<div>
				<span class={LABEL_CLASS}>{t("edit.tags", "Tags")}</span>
				<div class="flex flex-wrap gap-2">
					{allTags.map((tag) => {
						const selected = tags.includes(tag.id);
						return (
							<button
								type="button"
								key={tag.id}
								onClick={() => toggleTag(tag.id)}
								class={`text-xs font-medium px-2.5 py-1 rounded-full border ${
									selected
										? "bg-blue-600 text-white border-blue-600"
										: "bg-gray-100 text-gray-600 border-transparent"
								}`}
							>
								{tag.name}
							</button>
						);
					})}
				</div>
			</div>

			{error && <div class="text-sm text-red-600">{error}</div>}

			<div
				class={`flex justify-end gap-2 pt-1 ${saving ? "opacity-60 pointer-events-none" : ""}`}
			>
				<ScoutButton
					variant="text"
					onClick={() => {
						if (!saving) onCancel();
					}}
				>
					{t("edit.cancel", "Cancel")}
				</ScoutButton>
				<ScoutButton onClick={handleSave}>
					{saving ? t("edit.saving", "Saving…") : t("edit.save", "Save")}
				</ScoutButton>
			</div>

			{footer && (
				<div class={saving ? "opacity-60 pointer-events-none" : ""}>
					{footer}
				</div>
			)}
		</div>
	);
}

// Deleting is irreversible and there's no undo path, so it takes two separate
// confirmations. Each stage puts its confirm button in a different place and
// style than the one before, so repeatedly tapping the same spot can never
// carry you through the whole sequence by accident.
function DeleteLocationSection({
	location,
	onDeleted,
}: {
	location: Location;
	onDeleted: (id: string) => void;
}) {
	const { t } = useTranslate("map");
	const [stage, setStage] = useState<0 | 1 | 2>(0);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDelete = () => {
		if (deleting) return;
		setDeleting(true);
		setError(null);
		deleteLocation(location.id)
			.then(() => {
				setDeleting(false);
				onDeleted(location.id);
			})
			.catch(() => {
				setDeleting(false);
				setStage(0);
				setError(
					t("edit.deleteError", "Could not delete the location. Try again."),
				);
			});
	};

	return (
		<div class="border-t border-gray-100 pt-3 mt-1">
			{error && <div class="text-sm text-red-600 mb-2">{error}</div>}

			{stage === 0 && (
				<button
					type="button"
					class="text-sm font-medium text-red-600 underline underline-offset-2"
					onClick={() => setStage(1)}
				>
					{t("edit.delete", "Delete location")}
				</button>
			)}

			{/* First confirmation: names what's being deleted. */}
			{stage === 1 && (
				<div class="rounded-lg border border-red-200 bg-red-50 p-3">
					<p class="text-sm text-red-800 mb-3">
						{t(
							"edit.deleteConfirm1",
							"Delete “{name}”? This cannot be undone.",
							{
								name: location.name,
							},
						)}
					</p>
					<div class="flex justify-end gap-2">
						<ScoutButton variant="text" onClick={() => setStage(0)}>
							{t("edit.cancel", "Cancel")}
						</ScoutButton>
						<button
							type="button"
							class="text-sm font-semibold text-red-700 px-3 py-2"
							onClick={() => setStage(2)}
						>
							{t("edit.deleteContinue", "Continue")}
						</button>
					</div>
				</div>
			)}

			{/* Second confirmation: the destructive button moves to the left and
			    becomes the filled one, so it isn't under the previous tap. */}
			{stage === 2 && (
				<div class="rounded-lg border border-red-300 bg-red-50 p-3">
					<p class="text-sm font-semibold text-red-800 mb-1">
						{t("edit.deleteConfirm2Title", "Are you absolutely sure?")}
					</p>
					<p class="text-sm text-red-800 mb-3">
						{t(
							"edit.deleteConfirm2",
							"The location is removed for everyone, permanently.",
						)}
					</p>
					<div
						class={`flex items-center gap-2 ${deleting ? "opacity-60 pointer-events-none" : ""}`}
					>
						<button
							type="button"
							class="text-sm font-semibold text-white bg-red-600 rounded-lg px-3 py-2"
							onClick={handleDelete}
						>
							{deleting
								? t("edit.deleting", "Deleting…")
								: t("edit.deleteFinal", "Yes, delete permanently")}
						</button>
						<ScoutButton variant="text" onClick={() => setStage(0)}>
							{t("edit.keep", "Keep location")}
						</ScoutButton>
					</div>
				</div>
			)}
		</div>
	);
}

function LocationEditForm({
	location,
	onCancel,
	onSaved,
	onDeleted,
}: {
	location: Location;
	onCancel: () => void;
	onSaved: (raw: RawLocation) => void;
	onDeleted?: (id: string) => void;
}) {
	const { t } = useTranslate("map");
	const raw = getRawLocation(location.id);

	if (!raw) {
		return (
			<div class="px-4 pb-4 text-sm text-red-600">
				{t("edit.error", "Could not save changes. Please try again.")}
			</div>
		);
	}

	return (
		<LocationForm
			initial={{
				name: { sv: raw.name.sv ?? "", en: raw.name.en ?? "" },
				description: {
					sv: raw.description.sv ?? "",
					en: raw.description.en ?? "",
				},
				icon_name: raw.icon_name,
				icon_variant: raw.icon_variant,
				color: raw.color,
				tags: raw.tags ?? [],
			}}
			onCancel={onCancel}
			onSubmit={(values) => saveLocation(location.id, values)}
			onSaved={onSaved}
			footer={
				onDeleted && (
					<DeleteLocationSection location={location} onDeleted={onDeleted} />
				)
			}
		/>
	);
}

// Defaults for a freshly placed pin, so it renders as a real marker the moment
// it's dropped and is savable without touching the icon/color fields.
export const NEW_LOCATION_ICON = "tabler-map-pin";
export const NEW_LOCATION_COLOR = "#15375c";

// Sheet for a location being created at `position` (dropped by tapping the map
// in edit mode). Unlike the edit sheet this isn't draggable — a stray downward
// swipe while filling in a form shouldn't discard the draft; Cancel does that.
export function NewLocationSheet({
	position,
	onCancel,
	onCreated,
}: {
	position: PointTuple;
	onCancel: () => void;
	onCreated: (raw: RawLocation) => void;
}) {
	const { t } = useTranslate("map");

	return (
		<motion.div
			key="new-location-sheet"
			class="fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl"
			initial={{ y: "100%" }}
			animate={{ y: 0 }}
			exit={{ y: "100%", transition: { duration: 0.2 } }}
			transition={{ type: "spring", stiffness: 400, damping: 40 }}
		>
			<AccentStrip color={NEW_LOCATION_COLOR} />

			<div class="flex items-center gap-3 px-4 py-3">
				<div class="flex-1 min-w-0">
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
						{t("edit.newLocation", "New location")}
					</p>
					<p class="text-sm text-gray-500">
						{position[0].toFixed(5)}, {position[1].toFixed(5)}
					</p>
				</div>
				<ScoutButton
					variant="text"
					icon={XIcon}
					iconOnly
					className="-mr-1 shrink-0"
					onClick={onCancel}
				>
					{t("bottomSheet.close")}
				</ScoutButton>
			</div>

			<LocationForm
				initial={{
					name: { sv: "", en: "" },
					description: { sv: "", en: "" },
					icon_name: NEW_LOCATION_ICON,
					icon_variant: "outline",
					color: NEW_LOCATION_COLOR,
					tags: [],
				}}
				onCancel={onCancel}
				onSubmit={(values) =>
					createLocation({
						...values,
						latitude: position[0],
						longitude: position[1],
						opening_hours: {},
					})
				}
				onSaved={onCreated}
			/>

			<div class="pb-safe" />
			<div
				class="absolute left-0 right-0 h-screen bg-white"
				style={{ top: "calc(100% - 1px)" }}
			/>
		</motion.div>
	);
}

function VillageBody({ villageNumber }: { villageNumber: string }) {
	const { t } = useTranslate("map");
	const [groups, setGroups] = useState<string[] | null>(null);

	useEffect(() => {
		getGroupsForVillage(villageNumber).then(setGroups);
	}, [villageNumber]);

	if (!groups) return <div class="h-4" />;
	if (groups.length === 0) return <div class="h-4" />;

	return (
		<div class="border-t border-gray-100 pb-2">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 px-4 py-2">
				{t("search.scoutGroups")}
			</h3>
			<ul>
				{groups.map((name) => (
					<li key={name} class="px-4 py-2 text-sm">
						{name}
					</li>
				))}
			</ul>
		</div>
	);
}

export function BottomSheet({
	result,
	onClose,
	onLocationClick,
	onHeightChange,
	editMode = false,
	hasPendingMove = false,
	onDiscardMove,
	onLocationUpdated,
	onLocationDeleted,
}: Props) {
	const { t } = useTranslate("map");
	const rootRef = useRef<HTMLDivElement>(null);
	const y = useMotionValue(window.innerHeight);
	const controls = useAnimation();
	const [editing, setEditing] = useState(false);

	const editingLocationId =
		result.type === "location" ? result.location.id : null;
	// Close the form when a different location is selected or edit mode is turned off.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on target/mode change.
	useEffect(() => {
		setEditing(false);
	}, [editingLocationId, editMode]);

	// The edit form's save PUTs the last-saved coordinates, so an unconfirmed drag
	// would be silently thrown away. Ask before starting the edit.
	const handleStartEditing = () => {
		if (hasPendingMove && result.type === "location") {
			const discard = confirm(
				t(
					"edit.moveDiscardConfirm",
					"You've got unsaved moves. Do you want to discard those moves?",
				),
			);
			if (!discard) return;
			onDiscardMove?.(result.location.id);
		}
		setEditing(true);
	};

	useEffect(() => {
		controls.start({
			y: 0,
			transition: { type: "spring", stiffness: 400, damping: 40 },
		});
	}, []);

	useLayoutEffect(() => {
		if (rootRef.current) onHeightChange(rootRef.current.offsetHeight);
	});

	const accentColor =
		result.type === "location"
			? result.location.category.color
			: result.type === "group"
				? (result.locations[0]?.category.color ?? "#6b7280")
				: result.type === "district"
					? (result.feature.properties?.color ?? "#6b7280")
					: result.type === "program"
						? "#15375c"
						: result.type === "square"
							? "#15375c"
							: "#6b7280";

	return (
		<motion.div
			ref={rootRef as never}
			key="bottom-sheet"
			class="fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl"
			style={{ y }}
			drag="y"
			dragConstraints={{ top: 0, bottom: 0 }}
			dragElastic={{ top: 0, bottom: 0.4 }}
			dragListener={!editing}
			onDragEnd={(_, info) => {
				if (info.offset.y > 80 || info.velocity.y > 400) {
					onClose();
				} else {
					controls.start({
						y: 0,
						transition: { type: "spring", stiffness: 400, damping: 40 },
					});
				}
			}}
			animate={controls}
			exit={{ y: "100%", transition: { duration: 0.2 } }}
		>
			<AccentStrip color={accentColor} />

			<div class="flex justify-center pt-2.5 pb-1">
				<div
					class={`w-10 h-1 rounded-full bg-gray-300 ${editing ? "opacity-40" : ""}`}
				/>
			</div>

			{/* Header */}
			<div class="flex items-center gap-3 px-4 py-3">
				{result.type === "location" && (
					<>
						<div
							class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
							style={{ backgroundColor: `${result.location.category.color}20` }}
						>
							<SheetIcon
								iconName={result.location.category.iconName}
								variant={result.location.category.iconVariant}
								size={22}
							/>
						</div>
						<h2 class="text-base font-semibold flex-1 min-w-0">
							{result.location.name}
						</h2>
					</>
				)}
				{result.type === "group" &&
					(() => {
						const rep = result.locations[0];
						return (
							<>
								{rep && (
									<div
										class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
										style={{ backgroundColor: `${rep.category.color}20` }}
									>
										<SheetIcon
											iconName={rep.category.iconName}
											variant={rep.category.iconVariant}
											size={22}
										/>
									</div>
								)}
								<div class="flex-1 min-w-0">
									<h2 class="text-base font-semibold truncate">
										{result.displayName}
									</h2>
									<p class="text-sm text-gray-500">
										{t("search.locationCount", {
											count: result.locations.length,
										})}
									</p>
								</div>
							</>
						);
					})()}
				{result.type === "district" && (
					<>
						{result.feature.properties?.color ? (
							<span
								class="w-4 h-4 rounded-sm shrink-0 mt-0.5"
								style={{ backgroundColor: result.feature.properties.color }}
							/>
						) : null}
						<h2 class="text-base font-semibold flex-1 min-w-0 truncate">
							{result.name}
						</h2>
					</>
				)}
				{result.type === "program" && (
					<div class="flex-1 min-w-0">
						<p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
							{t("search.programs", "Program")}
						</p>
						<h2 class="text-base font-semibold truncate">{result.name}</h2>
					</div>
				)}
				{result.type === "square" && (
					<>
						<span
							class="w-4 h-4 rounded-sm shrink-0 mt-0.5"
							style={{ backgroundColor: "#15375c" }}
						/>
						<h2 class="text-base font-semibold flex-1 min-w-0 truncate">
							{result.name}
						</h2>
					</>
				)}
				{result.type === "village" && (
					<h2 class="text-base font-semibold flex-1 min-w-0">
						{t("search.village", { number: result.villageNumber })}
					</h2>
				)}
				{editMode && result.type === "location" && !editing && (
					<ScoutButton
						variant="text"
						icon={PencilIcon}
						iconOnly
						className="shrink-0"
						onClick={handleStartEditing}
					>
						{t("edit.edit", "Edit")}
					</ScoutButton>
				)}
				<ScoutButton
					variant="text"
					icon={XIcon}
					iconOnly
					className="-mr-1 shrink-0"
					onClick={onClose}
				>
					{t("bottomSheet.close")}
				</ScoutButton>
			</div>

			{/* Body */}
			{result.type === "location" &&
				(editing ? (
					<LocationEditForm
						location={result.location}
						onCancel={() => setEditing(false)}
						onSaved={(raw) => {
							onLocationUpdated?.(raw);
							setEditing(false);
						}}
						onDeleted={
							onLocationDeleted &&
							((id) => {
								setEditing(false);
								onLocationDeleted(id);
							})
						}
					/>
				) : (
					<LocationBody location={result.location} />
				))}

			{result.type === "village" && (
				<VillageBody villageNumber={result.villageNumber} />
			)}

			{result.type === "group" && (
				<ul class="overflow-y-auto max-h-64 border-t border-gray-100">
					{result.locations.map((loc) => (
						<li key={loc.id}>
							<button
								type="button"
								class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100"
								onClick={() => onLocationClick(loc)}
							>
								<SheetIcon
									iconName={loc.category.iconName}
									variant={loc.category.iconVariant}
								/>
								<span class="text-sm">{loc.name}</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<div class="pb-safe" />
			{/* Extends the white background below the sheet so dragging up shows no gap */}
			<div
				class="absolute left-0 right-0 h-screen bg-white"
				style={{ top: "calc(100% - 1px)" }}
			/>
		</motion.div>
	);
}
