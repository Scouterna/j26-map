import { motion } from "motion/react";
import { useEffect, useState } from "preact/hooks";
import { getIconURL } from "../common/icons";
import { initSearch, search } from "../common/searchService";
import type { SearchResult } from "../common/searchTypes";

initSearch();

type Props = {
	searchValue: string;
};

function ResultIcon({ iconName, variant = "outline" }: { iconName: string; variant?: "outline" | "filled" }) {
	return (
		<img
			src={getIconURL(iconName, variant)}
			width={20}
			height={20}
			class="shrink-0 opacity-70"
			alt=""
		/>
	);
}

function ResultRow({ result, onClick }: { result: SearchResult; onClick: () => void }) {
	if (result.type === "location") {
		return (
			<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={onClick}>
				<ResultIcon iconName={result.location.category.iconName} variant={result.location.category.iconVariant} />
				<span class="text-sm">{result.location.name}</span>
			</button>
		);
	}

	if (result.type === "group") {
		const representative = result.locations[0];
		return (
			<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={onClick}>
				{representative
					? <ResultIcon iconName={representative.category.iconName} variant={representative.category.iconVariant} />
					: null}
				<span class="text-sm flex-1">{result.displayName}</span>
				<span class="text-xs text-gray-400 shrink-0">{result.locations.length} platser</span>
			</button>
		);
	}

	if (result.type === "district") {
		return (
			<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={onClick}>
				<ResultIcon iconName="map" />
				<span class="text-sm">{result.name}</span>
			</button>
		);
	}

	if (result.type === "village") {
		return (
			<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={onClick}>
				<ResultIcon iconName="home" />
				<span class="text-sm">By {result.villageNumber}</span>
			</button>
		);
	}

	return null;
}

function resultKey(result: SearchResult): string {
	if (result.type === "location") return `location-${result.location.id}`;
	if (result.type === "group") return `group-${result.tag}`;
	if (result.type === "district") return `district-${result.name}`;
	return `village-${result.villageNumber}`;
}

export function ResultsPane({ searchValue }: Props) {
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!searchValue.trim()) {
			setResults([]);
			return;
		}

		setLoading(true);
		search(searchValue).then((r) => {
			setResults(r);
			setLoading(false);
		});
	}, [searchValue]);

	const isEmpty = !loading && searchValue.trim() !== "" && results.length === 0;

	return (
		<motion.div
			key="results-pane"
			class="fixed h-dvh w-full top-0 left-0 z-30 pt-16 bg-white overflow-y-auto"
			initial={{ opacity: 0, top: -5 }}
			animate={{ opacity: 1, top: 0, transition: { duration: 0.08 } }}
			exit={{ opacity: 0, top: 0, transition: { duration: 0.08 } }}
		>
			{loading ? (
				<p class="px-4 py-3 text-sm text-gray-400">Söker...</p>
			) : isEmpty ? (
				<p class="px-4 py-3 text-sm text-gray-400">Inga resultat</p>
			) : (
				<ul>
					{results.map((result) => (
						<li key={resultKey(result)}>
							<ResultRow result={result} onClick={() => console.log("result clicked", result)} />
						</li>
					))}
				</ul>
			)}
		</motion.div>
	);
}
