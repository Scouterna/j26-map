import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { getLocations } from "./locationService";
import type { Location } from "./locationTypes";
import type {
	SearchResult,
	SearchResultDistrict,
	SearchResultGroup,
	SearchResultLocation,
	SearchResultVillage,
} from "./searchTypes";

type SearchIndex = {
	locations: Location[];
	groups: Map<string, { displayName: string; locations: Location[] }>;
	villages: Array<{ villageNumber: string; labelPoint: [number, number]; polygon: Feature | null }>;
	districts: Array<{ name: string; feature: Feature }>;
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

function matches(query: string, candidate: string): boolean {
	return normalize(candidate).includes(normalize(query));
}

async function buildIndex(): Promise<SearchIndex> {
	const [locations, groupsRaw, villageLabelsRaw, villagesRaw, districtsRaw] = await Promise.all([
		getLocations(),
		fetch("./location-groups.json").then((r) => r.json() as Promise<Record<string, string>>),
		fetch("./layers/village_labels.geojson").then((r) => r.json() as Promise<FeatureCollection>),
		fetch("./layers/villages.geojson").then((r) => r.json() as Promise<FeatureCollection>),
		fetch("./layers/districts.geojson").then((r) => r.json() as Promise<FeatureCollection>),
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

	// Build village spatial index: for each label point find containing village polygon
	const villagePolygons = (villagesRaw.features as Feature<LineString>[]).filter((f) => f.geometry != null);
	const villages = (villageLabelsRaw.features as Feature<Point>[]).map((labelFeature) => {
		const [lng, lat] = labelFeature.geometry.coordinates;
		const villageNumber = String(labelFeature.properties?.village_number ?? "");

		let polygon: Feature | null = null;
		for (const vf of villagePolygons) {
			const ring = vf.geometry.coordinates as number[][];
			if (ring.length >= 3 && pointInPolygon(lng, lat, ring)) {
				polygon = vf as Feature;
				break;
			}
		}

		return { villageNumber, labelPoint: [lat, lng] as [number, number], polygon };
	});

	// Districts
	const districts = (districtsRaw.features as Feature[])
		.filter((f) => f.properties?.name)
		.map((f) => ({ name: f.properties!.name as string, feature: f }));

	return { locations, groups, villages, districts };
}

let indexPromise: Promise<SearchIndex> | null = null;

function getIndex(): Promise<SearchIndex> {
	if (!indexPromise) indexPromise = buildIndex();
	return indexPromise;
}

export function initSearch(): void {
	getIndex();
}

export async function search(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	const index = await getIndex();
	const results: SearchResult[] = [];

	// Group results
	for (const [tag, group] of index.groups) {
		if (group.locations.length > 0 && matches(query, group.displayName)) {
			results.push({
				type: "group",
				tag,
				displayName: group.displayName,
				locations: group.locations,
			} satisfies SearchResultGroup);
		}
	}

	// Individual location results — only untagged locations (tagged ones are represented via groups)
	for (const loc of index.locations) {
		if (loc.tags.length === 0 && matches(query, loc.name)) {
			results.push({ type: "location", location: loc } satisfies SearchResultLocation);
		}
	}

	// District results
	for (const district of index.districts) {
		if (matches(query, district.name)) {
			results.push({
				type: "district",
				name: district.name,
				feature: district.feature,
			} satisfies SearchResultDistrict);
		}
	}

	// Village results — match on village_number substring
	const normalizedQuery = normalize(query);
	for (const village of index.villages) {
		if (village.villageNumber.includes(normalizedQuery)) {
			results.push({
				type: "village",
				villageNumber: village.villageNumber,
				labelPoint: village.labelPoint,
				polygon: village.polygon,
			} satisfies SearchResultVillage);
		}
	}

	return results;
}
