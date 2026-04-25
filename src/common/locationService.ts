import type { IconVariant } from "./icons";
import type { Location } from "./locationTypes";

type RawLocation = {
	id: number;
	slug: string;
	name: string;
	lat: number;
	lng: number;
	icon: string;
	iconVariant: IconVariant;
	color: string;
};

export async function getLocations(): Promise<Location[]> {
	const res = await fetch("./locations.json");
	const raw: RawLocation[] = await res.json();
	return raw.map((loc) => ({
		id: String(loc.id),
		name: loc.name,
		position: [loc.lat, loc.lng],
		category: {
			iconName: loc.icon,
			iconVariant: loc.iconVariant,
			color: loc.color,
		},
	}));
}
