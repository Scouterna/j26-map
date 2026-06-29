import type { Feature, FeatureCollection } from "geojson";
import MiniSearch from "minisearch";
import { getLocations } from "./locationService";
import type { Location } from "./locationTypes";
import type { SearchResult } from "./searchTypes";
import { getVillageEntries, type VillageEntry } from "./villageService";

type SearchIndex = {
	ms: MiniSearch<{ id: string; name: string }>;
	resultMap: Map<string, SearchResult>;
};

// Ray-casting point-in-polygon. coords are [lng, lat] pairs.
function pointInPolygon(lng: number, lat: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0], yi = ring[i][1];
		const xj = ring[j][0], yj = ring[j][1];
		if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

function normalize(s: string): string {
	return s
		.toLowerCase()
		.replace(/å/g, "a")
		.replace(/ä/g, "a")
		.replace(/ö/g, "o")
		.replace(/é/g, "e")
		.replace(/ü/g, "u");
}

async function buildIndex(): Promise<SearchIndex> {
	const [locations, groupsRaw, villages, districtsRaw, scoutGroupsRaw] = await Promise.all([
		getLocations(),
		fetch("./location-groups.json").then((r) => r.json() as Promise<Record<string, string>>),
		getVillageEntries(),
		fetch("./layers/districts.geojson").then((r) => r.json() as Promise<FeatureCollection>),
		fetch("./scout-groups.json").then((r) => r.json() as Promise<Array<{ name: string; village: string }>>),
	]);

	// Build group map: tag → { displayName, locations[] }
	const groups = new Map<string, { displayName: string; locations: Location[] }>();
	for (const [tag, displayName] of Object.entries(groupsRaw)) {
		groups.set(tag, { displayName, locations: [] });
	}
	for (const loc of locations) {
		for (const tag of loc.tags) {
			groups.get(tag)?.locations.push(loc);
		}
	}

	// Districts
	const districts = (districtsRaw.features as Feature[])
		.filter((f) => f.properties?.name)
		.map((f) => ({ name: f.properties!.name as string, feature: f }));

	// Scout groups — resolve each to a village entry
	const villageByNumber = new Map(villages.map((v) => [v.villageNumber, v]));
	const scoutGroups = scoutGroupsRaw
		.map(({ name, village }) => ({ name, village: villageByNumber.get(village) ?? null }))
		.filter((sg) => sg.village !== null) as Array<{ name: string; village: VillageEntry }>;

	// Build MiniSearch index
	const ms = new MiniSearch<{ id: string; name: string }>({
		fields: ["name"],
		processTerm: normalize,
		searchOptions: {
			prefix: true,
			fuzzy: 0.2,
			combineWith: "AND",
		},
	});

	const resultMap = new Map<string, SearchResult>();
	const docs: Array<{ id: string; name: string }> = [];

	for (const [tag, group] of groups) {
		if (group.locations.length > 0) {
			const id = `group-${tag}`;
			docs.push({ id, name: group.displayName });
			resultMap.set(id, { type: "group", tag, displayName: group.displayName, locations: group.locations });
		}
	}

	for (const loc of locations) {
		if (loc.tags.length === 0) {
			const id = `loc-${loc.id}`;
			docs.push({ id, name: loc.name });
			resultMap.set(id, { type: "location", location: loc });
		}
	}

	for (let i = 0; i < districts.length; i++) {
		const d = districts[i];
		const id = `district-${i}`;
		docs.push({ id, name: d.name });
		resultMap.set(id, { type: "district", name: d.name, feature: d.feature });
	}

	for (const village of villages) {
		const id = `village-${village.villageNumber}`;
		// Index both the bare number and "By <number>" so either query form matches
		docs.push({ id, name: `By ${village.villageNumber}` });
		resultMap.set(id, {
			type: "village",
			villageNumber: village.villageNumber,
			labelPoint: village.labelPoint,
			polygon: village.polygon,
		});
	}

	for (const sg of scoutGroups) {
		const id = `sg-${sg.name}`;
		docs.push({ id, name: sg.name });
		resultMap.set(id, {
			type: "scout-group",
			groupName: sg.name,
			village: {
				type: "village",
				villageNumber: sg.village.villageNumber,
				labelPoint: sg.village.labelPoint,
				polygon: sg.village.polygon,
			},
		});
	}

	ms.addAll(docs);

	return { ms, resultMap };
}

let indexPromise: Promise<SearchIndex> | null = null;

function getIndex(): Promise<SearchIndex> {
	if (!indexPromise) indexPromise = buildIndex();
	return indexPromise;
}

export function initSearch(): void {
	getIndex();
}

export async function getGroups(): Promise<Array<{ tag: string; displayName: string }>> {
	const index = await getIndex();
	return Array.from(index.resultMap.entries())
		.filter((e): e is [string, Extract<SearchResult, { type: "group" }>] => e[1].type === "group")
		.map(([, r]) => ({ tag: r.tag, displayName: r.displayName }));
}

export async function search(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	const index = await getIndex();

	return index.ms
		.search(query)
		.map((r) => index.resultMap.get(r.id))
		.filter((r): r is SearchResult => r !== undefined);
}
