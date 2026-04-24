import type { Location } from "./locationTypes";

type RawLocation = {
	id: number;
	slug: string;
	name: string;
	lat: number;
	lng: number;
};

const PLACEHOLDER_CATEGORY = {
	iconName: "question-mark",
	iconVariant: "outline" as const,
	color: "#334155",
};

export async function getLocations(): Promise<Location[]> {
	const res = await fetch("./locations.json");
	const raw: RawLocation[] = await res.json();
	return raw.map((loc) => ({
		id: String(loc.id),
		name: loc.name,
		position: [loc.lat, loc.lng],
		category: PLACEHOLDER_CATEGORY,
	}));
}
