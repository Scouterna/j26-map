import { ScoutButton } from "@scouterna/ui-react";
import XIcon from "@tabler/icons/outline/x.svg?raw";
import { motion, useAnimation, useMotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { getIconURL } from "../common/icons";
import type { Aktivitet, Location, OpeningHourSlot } from "../common/locationTypes";
import type { SearchResult } from "../common/searchTypes";

const GROUP_LABELS: Record<string, string> = {
	wc: "Toaletter",
	hwc: "Handikapptoaletter",
	shower: "Duschar",
	"shower-wc": "Dusch & Toalett",
	slanforrad: "Slanförråd",
};

const TODAY = new Date().toISOString().slice(0, 10);
const MAX_PREVIEW_AKTIVITETER = 3;

type Props = {
	result: SearchResult;
	onClose: () => void;
	onLocationClick: (loc: Location) => void;
	onHeightChange: (height: number) => void;
};

function SheetIcon({ iconName, variant = "outline", size = 24 }: { iconName: string; variant?: "outline" | "filled"; size?: number }) {
	return (
		<img src={getIconURL(iconName, variant)} width={size} height={size} class="shrink-0 opacity-80" alt="" />
	);
}

function AccentStrip({ color }: { color: string }) {
	return <div class="rounded-t-2xl h-1.5 w-full" style={{ backgroundColor: color }} />;
}

function OpeningHours({ slots }: { slots: OpeningHourSlot[] }) {
	const text = slots.map((s) => `${s.from}–${s.to}`).join(", ");
	return (
		<div class="flex items-center gap-1.5 px-4 pb-2 text-sm text-gray-500">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
				<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
			</svg>
			<span>Öppet {text}</span>
		</div>
	);
}

function AktivitetRow({ aktivitet }: { aktivitet: Aktivitet }) {
	return (
		<div class="flex items-start gap-3 px-4 py-2.5">
			<span class="text-xs font-mono text-gray-400 pt-0.5 shrink-0 w-[88px]">
				{aktivitet.from}–{aktivitet.to}
			</span>
			<span class="text-sm font-medium leading-snug">{aktivitet.name}</span>
		</div>
	);
}

function AktiviteterSection({ location }: { location: Location }) {
	const all = location.aktiviteter?.[TODAY] ?? [];
	if (all.length === 0) return null;

	const preview = all.slice(0, MAX_PREVIEW_AKTIVITETER);
	const remaining = all.length - preview.length;

	return (
		<div class="border-t border-gray-100 pt-1 mt-1">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 px-4 py-2">
				Aktiviteter idag
			</h3>
			{preview.map((a) => <AktivitetRow key={a.id} aktivitet={a} />)}
			{remaining > 0 && (
				<button
					type="button"
					class="w-full text-left px-4 py-2.5 text-sm font-medium text-blue-600 hover:underline"
				>
					Visa alla {all.length} aktiviteter →
				</button>
			)}
		</div>
	);
}

function LocationBody({ location }: { location: Location }) {
	const tagLabels = location.tags.map((t) => GROUP_LABELS[t]).filter(Boolean);
	const todayHours = location.openingHours?.[TODAY];

	return (
		<div class="pb-2">
			{todayHours && <OpeningHours slots={todayHours} />}
			{tagLabels.length > 0 && (
				<div class="flex flex-wrap gap-2 px-4 pb-3">
					{tagLabels.map((label) => (
						<span key={label} class="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
							{label}
						</span>
					))}
				</div>
			)}
			<AktiviteterSection location={location} />
			{!todayHours && tagLabels.length === 0 && !location.aktiviteter?.[TODAY]?.length && (
				<div class="h-4" />
			)}
		</div>
	);
}

export function BottomSheet({ result, onClose, onLocationClick, onHeightChange }: Props) {
	const rootRef = useRef<HTMLDivElement>(null);
	const y = useMotionValue(window.innerHeight);
	const controls = useAnimation();

	useEffect(() => {
		controls.start({ y: 0, transition: { type: "spring", stiffness: 400, damping: 40 } });
	}, []);

	useLayoutEffect(() => {
		if (rootRef.current) onHeightChange(rootRef.current.offsetHeight);
	});

	const accentColor =
		result.type === "location"
			? result.location.category.color
			: result.type === "group"
				? result.locations[0]?.category.color ?? "#6b7280"
				: result.type === "district"
					? (result.feature.properties?.color ?? "#6b7280")
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
			dragListener={true}
			onDragEnd={(_, info) => {
				if (info.offset.y > 80 || info.velocity.y > 400) {
					onClose();
				} else {
					controls.start({ y: 0, transition: { type: "spring", stiffness: 400, damping: 40 } });
				}
			}}
			animate={controls}
			exit={{ y: "100%", transition: { duration: 0.2 } }}
		>
			<AccentStrip color={accentColor} />

			<div class="flex justify-center pt-2.5 pb-1">
				<div class="w-10 h-1 rounded-full bg-gray-300" />
			</div>

			{/* Header */}
			<div class="flex items-center gap-3 px-4 py-3">
				{result.type === "location" && (
					<>
						<div
							class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
							style={{ backgroundColor: `${result.location.category.color}20` }}
						>
							<SheetIcon iconName={result.location.category.iconName} variant={result.location.category.iconVariant} size={22} />
						</div>
						<h2 class="text-base font-semibold flex-1 min-w-0">{result.location.name}</h2>
					</>
				)}
				{result.type === "group" && (() => {
					const rep = result.locations[0];
					return (
						<>
							{rep && (
								<div
									class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
									style={{ backgroundColor: `${rep.category.color}20` }}
								>
									<SheetIcon iconName={rep.category.iconName} variant={rep.category.iconVariant} size={22} />
								</div>
							)}
							<div class="flex-1 min-w-0">
								<h2 class="text-base font-semibold truncate">{result.displayName}</h2>
								<p class="text-sm text-gray-500">{result.locations.length} platser</p>
							</div>
						</>
					);
				})()}
				{result.type === "district" && (
					<>
						{result.feature.properties?.color
							? <span class="w-4 h-4 rounded-sm shrink-0 mt-0.5" style={{ backgroundColor: result.feature.properties.color }} />
							: null}
						<h2 class="text-base font-semibold flex-1 min-w-0 truncate">{result.name}</h2>
					</>
				)}
				{result.type === "village" && (
					<h2 class="text-base font-semibold flex-1 min-w-0">By {result.villageNumber}</h2>
				)}
				<ScoutButton variant="text" icon={XIcon} iconOnly className="-mr-1 shrink-0" onClick={onClose}>
					Stäng
				</ScoutButton>
			</div>

			{/* Body */}
			{result.type === "location" && <LocationBody location={result.location} />}

			{result.type === "group" && (
				<ul class="overflow-y-auto max-h-64 border-t border-gray-100">
					{result.locations.map((loc) => (
						<li key={loc.id}>
							<button
								type="button"
								class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100"
								onClick={() => onLocationClick(loc)}
							>
								<SheetIcon iconName={loc.category.iconName} variant={loc.category.iconVariant} />
								<span class="text-sm">{loc.name}</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<div class="pb-safe" />
			{/* Extends the white background below the sheet so dragging up shows no gap */}
			<div class="absolute left-0 right-0 h-screen bg-white" style={{ top: "calc(100% - 1px)" }} />
		</motion.div>
	);
}
