import { motion } from "motion/react";
import { useEffect, useRef, useState } from "preact/hooks";
import { getIconURL } from "../common/icons";
import { getGroups, initSearch, search } from "../common/searchService";
import type { SearchResult } from "../common/searchTypes";

initSearch();

// --- Recent searches (localStorage) ---

const RECENT_KEY = "j26-recent-searches";
const MAX_RECENT = 8;

type RecentEntry = { key: string; label: string; result: SearchResult };

function recentKey(result: SearchResult): string {
	if (result.type === "location") return `location-${result.location.id}`;
	if (result.type === "group") return `group-${result.tag}`;
	if (result.type === "village") return `village-${result.villageNumber}`;
	if (result.type === "district") return `district-${result.name}`;
	if (result.type === "scout-group") return `sg-${result.groupName}`;
	return "";
}

function recentLabel(result: SearchResult): string {
	if (result.type === "location") return result.location.name;
	if (result.type === "group") return result.displayName;
	if (result.type === "village") return `By ${result.villageNumber}`;
	if (result.type === "district") return result.name;
	if (result.type === "scout-group") return result.groupName;
	return "";
}

function loadRecent(): RecentEntry[] {
	try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
	catch { return []; }
}

function saveRecent(result: SearchResult): void {
	const entry: RecentEntry = { key: recentKey(result), label: recentLabel(result), result };
	const items = loadRecent().filter((r) => r.key !== entry.key);
	items.unshift(entry);
	localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
}

// --- Icons ---

function ResultIcon({ iconName, variant = "outline" }: { iconName: string; variant?: "outline" | "filled" }) {
	return <img src={getIconURL(iconName, variant)} width={20} height={20} class="shrink-0 opacity-70" alt="" />;
}

function ClockIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-gray-400">
			<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
		</svg>
	);
}

// --- Row components ---

function ResultRow({ result, onClick }: { result: SearchResult; onClick: () => void }) {
	if (result.type === "location") {
		return (
			<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={onClick}>
				<ResultIcon iconName={result.location.category.iconName} variant={result.location.category.iconVariant} />
				<span class="text-sm">{result.location.name}</span>
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
	if (result.type === "district") {
		return (
			<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={onClick}>
				<ResultIcon iconName="map" />
				<span class="text-sm">{result.name}</span>
			</button>
		);
	}
	if (result.type === "scout-group") {
		return (
			<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={onClick}>
				<ResultIcon iconName="users-group" />
				<div class="flex flex-col min-w-0">
					<span class="text-sm">{result.groupName}</span>
					<span class="text-xs text-gray-400">By {result.village.villageNumber}</span>
				</div>
			</button>
		);
	}
	return null;
}

function CategoryCard({ result, onClick }: { result: Extract<SearchResult, { type: "group" }>; onClick: () => void }) {
	const rep = result.locations[0];
	return (
		<button type="button" class="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100" onClick={onClick}>
			{rep && (
				<div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-gray-100">
					<ResultIcon iconName={rep.category.iconName} variant={rep.category.iconVariant} />
				</div>
			)}
			<div class="flex-1 min-w-0">
				<div class="text-sm font-medium">Visa alla {result.displayName.toLowerCase()}</div>
				<div class="text-xs text-gray-400">{result.locations.length} platser</div>
			</div>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-gray-400">
				<polyline points="9 18 15 12 9 6" />
			</svg>
		</button>
	);
}

function SectionHeader({ title }: { title: string }) {
	return <div class="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</div>;
}

// --- Empty state ---

type CategoryChip = { tag: string; label: string };

function EmptyState({ categories, onCategoryClick, recents, onRecentClick }: {
	categories: CategoryChip[];
	onCategoryClick: (label: string) => void;
	recents: RecentEntry[];
	onRecentClick: (result: SearchResult) => void;
}) {
	return (
		<div>
			{recents.length > 0 && (
				<>
					<SectionHeader title="Senaste" />
					<ul>
						{recents.map((entry) => (
							<li key={entry.key}>
								<button type="button" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 active:bg-gray-100" onClick={() => onRecentClick(entry.result)}>
									<ClockIcon />
									<span class="text-sm">{entry.label}</span>
								</button>
							</li>
						))}
					</ul>
				</>
			)}
			{categories.length > 0 && (
				<>
					<SectionHeader title="Kategorier" />
					<div class="flex flex-wrap gap-2 px-4 py-2">
						{categories.map(({ tag, label }) => (
							<button key={tag} type="button" class="text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300" onClick={() => onCategoryClick(label)}>
								{label}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}

// --- Main component ---

type Props = {
	searchValue: string;
	onResultClick: (result: SearchResult) => void;
};

function resultKey(result: SearchResult): string {
	if (result.type === "location") return `location-${result.location.id}`;
	if (result.type === "group") return `group-${result.tag}`;
	if (result.type === "district") return `district-${result.name}`;
	if (result.type === "village") return `village-${result.villageNumber}`;
	if (result.type === "scout-group") return `scout-group-${result.groupName}`;
	return "";
}

export function ResultsPane({ searchValue, onResultClick }: Props) {
	const [results, setResults] = useState<SearchResult[]>([]);
	const [categories, setCategories] = useState<CategoryChip[]>([]);
	const [recents, setRecents] = useState<RecentEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const recentsLoadedRef = useRef(false);

	useEffect(() => {
		getGroups().then((groups) => setCategories(groups.map(({ tag, displayName }) => ({ tag, label: displayName }))));
	}, []);

	useEffect(() => {
		if (!searchValue.trim()) {
			setResults([]);
			if (!recentsLoadedRef.current) {
				setRecents(loadRecent());
				recentsLoadedRef.current = true;
			}
			return;
		}
		setLoading(true);
		search(searchValue).then((r) => { setResults(r); setLoading(false); });
	}, [searchValue]);

	const handleClick = (result: SearchResult) => {
		saveRecent(result);
		setRecents(loadRecent());
		onResultClick(result);
	};

	const handleCategoryChip = async (label: string) => {
		const hits = await search(label);
		const match = hits.find((r) => r.type === "group");
		if (match) handleClick(match);
	};

	const isEmpty = !loading && searchValue.trim() !== "" && results.length === 0;
	const showEmpty = !searchValue.trim();

	const groupResults = results.filter((r): r is Extract<SearchResult, { type: "group" }> => r.type === "group");
	const locationResults = results.filter((r) => r.type === "location");
	const villageResults = results.filter((r) => r.type === "village");
	const districtResults = results.filter((r) => r.type === "district");
	const scoutGroupResults = results.filter((r) => r.type === "scout-group");

	return (
		<motion.div
			key="results-pane"
			class="fixed h-dvh w-full top-0 left-0 z-30 pt-16 bg-white overflow-y-auto"
			initial={{ opacity: 0, top: -5 }}
			animate={{ opacity: 1, top: 0, transition: { duration: 0.08 } }}
			exit={{ opacity: 0, top: 0, transition: { duration: 0.08 } }}
		>
			{showEmpty ? (
				<EmptyState categories={categories} onCategoryClick={handleCategoryChip} recents={recents} onRecentClick={handleClick} />
			) : loading ? (
				<p class="px-4 py-3 text-sm text-gray-400">Söker...</p>
			) : isEmpty ? (
				<p class="px-4 py-3 text-sm text-gray-400">Inga resultat</p>
			) : (
				<>
					{groupResults.map((r) => (
						<CategoryCard key={resultKey(r)} result={r} onClick={() => handleClick(r)} />
					))}

					{locationResults.length > 0 && (
						<>
							{groupResults.length > 0 && <SectionHeader title="Platser" />}
							<ul>
								{locationResults.map((r) => (
									<li key={resultKey(r)}>
										<ResultRow result={r} onClick={() => handleClick(r)} />
									</li>
								))}
							</ul>
						</>
					)}

					{villageResults.length > 0 && (
						<>
							<SectionHeader title="Byar" />
							<ul>
								{villageResults.map((r) => (
									<li key={resultKey(r)}>
										<ResultRow result={r} onClick={() => handleClick(r)} />
									</li>
								))}
							</ul>
						</>
					)}

					{districtResults.length > 0 && (
						<>
							<SectionHeader title="Distrikt" />
							<ul>
								{districtResults.map((r) => (
									<li key={resultKey(r)}>
										<ResultRow result={r} onClick={() => handleClick(r)} />
									</li>
								))}
							</ul>
						</>
					)}

					{scoutGroupResults.length > 0 && (
						<>
							<SectionHeader title="Kårer" />
							<ul>
								{scoutGroupResults.map((r) => (
									<li key={resultKey(r)}>
										<ResultRow result={r} onClick={() => handleClick(r)} />
									</li>
								))}
							</ul>
						</>
					)}
				</>
			)}
		</motion.div>
	);
}
