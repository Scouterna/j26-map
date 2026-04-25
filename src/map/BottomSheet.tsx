import { ScoutButton } from "@scouterna/ui-react";
import XIcon from "@tabler/icons/outline/x.svg?raw";
import { motion } from "motion/react";
import { useLayoutEffect, useRef } from "preact/hooks";
import { getIconURL } from "../common/icons";
import type { Location } from "../common/locationTypes";
import type { SearchResult } from "../common/searchTypes";

type Props = {
	result: SearchResult;
	onClose: () => void;
	onLocationClick: (loc: Location) => void;
	onHeightChange: (height: number) => void;
};

function SheetIcon({ iconName, variant = "outline" }: { iconName: string; variant?: "outline" | "filled" }) {
	return (
		<img
			src={getIconURL(iconName, variant)}
			width={24}
			height={24}
			class="shrink-0 opacity-70"
			alt=""
		/>
	);
}

function SheetHeader({ result }: { result: SearchResult }) {
	if (result.type === "location") {
		return (
			<>
				<SheetIcon iconName={result.location.category.iconName} variant={result.location.category.iconVariant} />
				<h2 class="text-base font-semibold flex-1 min-w-0 truncate">{result.location.name}</h2>
			</>
		);
	}
	if (result.type === "group") {
		const rep = result.locations[0];
		return (
			<>
				{rep ? <SheetIcon iconName={rep.category.iconName} variant={rep.category.iconVariant} /> : null}
				<div class="flex-1 min-w-0">
					<h2 class="text-base font-semibold truncate">{result.displayName}</h2>
					<p class="text-sm text-gray-500">{result.locations.length} platser</p>
				</div>
			</>
		);
	}
	if (result.type === "district") {
		return (
			<>
				{result.feature.properties?.color
					? <span class="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: result.feature.properties.color }} />
					: null}
				<h2 class="text-base font-semibold flex-1 min-w-0 truncate">{result.name}</h2>
			</>
		);
	}
	// village
	return <h2 class="text-base font-semibold flex-1 min-w-0">By {result.villageNumber}</h2>;
}

export function BottomSheet({ result, onClose, onLocationClick, onHeightChange }: Props) {
	const rootRef = useRef<HTMLDivElement>(null);

	// Measure after every render so map padding stays in sync when content changes
	// (e.g. group → location drill-down changes sheet height).
	// useLayoutEffect fires before paint, so MapInteraction's useEffect (after paint)
	// always reads the up-to-date height.
	useLayoutEffect(() => {
		if (rootRef.current) onHeightChange(rootRef.current.offsetHeight);
	});

	return (
		<motion.div
			ref={rootRef as never}
			key="bottom-sheet"
			class="fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl"
			initial={{ y: "100%" }}
			animate={{ y: 0, transition: { type: "spring", stiffness: 400, damping: 40 } }}
			exit={{ y: "100%", transition: { duration: 0.2 } }}
		>
			{/* Handle */}
			<div class="flex justify-center pt-3 pb-1">
				<div class="w-10 h-1 rounded-full bg-gray-300" />
			</div>

			{/* Header */}
			<div class="flex items-center gap-3 px-4 py-3">
				<SheetHeader result={result} />
				<ScoutButton
					variant="text"
					icon={XIcon}
					iconOnly
					className="-mr-1 shrink-0"
					onClick={onClose}
				>
					Stäng
				</ScoutButton>
			</div>

			{/* Group location list */}
			{result.type === "group" ? (
				<ul class="overflow-y-auto max-h-64 border-t border-gray-100 pb-safe">
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
			) : (
				<div class="pb-safe" />
			)}
		</motion.div>
	);
}
