import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { SearchResultVillage } from "./searchTypes";

export type VillageEntry = {
	villageNumber: string;
	labelPoint: [number, number]; // [lat, lng]
	polygon: Feature | null;
};

// Ray-casting point-in-polygon. coords are [lng, lat] pairs.
export function pointInPolygon(lng: number, lat: number, ring: number[][]): boolean {
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

let entriesPromise: Promise<VillageEntry[]> | null = null;

async function buildEntries(): Promise<VillageEntry[]> {
	const [labelsRaw, villagesRaw] = await Promise.all([
		fetch("./layers/village_labels.geojson").then((r) => r.json() as Promise<FeatureCollection>),
		fetch("./layers/villages.geojson").then((r) => r.json() as Promise<FeatureCollection>),
	]);

	const polygons = (villagesRaw.features as Feature<LineString>[]).filter((f) => f.geometry != null);

	return (labelsRaw.features as Feature<Point>[]).map((labelFeature) => {
		const [lng, lat] = labelFeature.geometry.coordinates;
		const villageNumber = String(labelFeature.properties?.village_number ?? "");

		let polygon: Feature | null = null;
		for (const vf of polygons) {
			const ring = vf.geometry.coordinates as number[][];
			if (ring.length >= 3 && pointInPolygon(lng, lat, ring)) {
				polygon = vf as Feature;
				break;
			}
		}

		return { villageNumber, labelPoint: [lat, lng] as [number, number], polygon };
	});
}

export function getVillageEntries(): Promise<VillageEntry[]> {
	if (!entriesPromise) entriesPromise = buildEntries();
	return entriesPromise;
}

export async function getVillageAtPoint(lng: number, lat: number): Promise<SearchResultVillage | null> {
	const entries = await getVillageEntries();
	for (const entry of entries) {
		if (!entry.polygon) continue;
		const ring = entry.polygon.geometry.coordinates as number[][];
		if (ring.length >= 3 && pointInPolygon(lng, lat, ring)) {
			return {
				type: "village",
				villageNumber: entry.villageNumber,
				labelPoint: entry.labelPoint,
				polygon: entry.polygon,
			};
		}
	}
	return null;
}
