import { ScoutButton } from "@scouterna/ui-react";
import PencilIcon from "@tabler/icons/outline/pencil.svg?raw";
import XIcon from "@tabler/icons/outline/x.svg?raw";
import { useTranslate } from "@tolgee/react";
import { motion, useAnimation, useMotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { getIconURL } from "../common/icons";
import { getRawLocation, saveLocation } from "../common/locationAdminService";
import {
	getLocationTagNames,
	getLocationTags,
	type LocationTag,
} from "../common/locationTagService";
import type {
	Location,
	OpeningHourSlot,
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
	onLocationUpdated?: (raw: RawLocation) => void;
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

function LocationEditForm({
	location,
	onCancel,
	onSaved,
}: {
	location: Location;
	onCancel: () => void;
	onSaved: (raw: RawLocation) => void;
}) {
	const { t } = useTranslate("map");
	const raw = getRawLocation(location.id);

	const [nameSv, setNameSv] = useState(raw?.name.sv ?? "");
	const [nameEn, setNameEn] = useState(raw?.name.en ?? "");
	const [descSv, setDescSv] = useState(raw?.description.sv ?? "");
	const [descEn, setDescEn] = useState(raw?.description.en ?? "");
	const [iconName, setIconName] = useState(raw?.icon_name ?? "");
	const [iconVariant, setIconVariant] = useState<"outline" | "filled">(
		raw?.icon_variant ?? "outline",
	);
	const [color, setColor] = useState(raw?.color ?? "#000000");
	const [tags, setTags] = useState<string[]>(raw?.tags ?? []);

	const [allTags, setAllTags] = useState<LocationTag[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getLocationTags().then(setAllTags);
	}, []);

	if (!raw) {
		return (
			<div class="px-4 pb-4 text-sm text-red-600">
				{t("edit.error", "Could not save changes. Please try again.")}
			</div>
		);
	}

	const toggleTag = (id: string) => {
		setTags((prev) =>
			prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
		);
	};

	const handleSave = () => {
		if (saving) return;
		setSaving(true);
		setError(null);
		saveLocation(location.id, {
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
		</div>
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
	onLocationUpdated,
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
						onClick={() => setEditing(true)}
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
