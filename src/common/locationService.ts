import type { IconVariant } from "./icons";
import type { Aktivitet, Location, OpeningHourSlot } from "./locationTypes";

type RawLocation = {
	id: number;
	name: string;
	lat: number;
	lng: number;
	icon: string;
	iconVariant: IconVariant;
	color: string;
	tags?: string[];
	openingHours?: Record<string, OpeningHourSlot[]>;
	aktiviteter?: Record<string, Aktivitet[]>;
};

export async function getLocations(): Promise<Location[]> {
	type MarkerSvgEntry = { src: string; aspectRatio: number };
	const [raw, markerSvgs] = await Promise.all([
		fetch("./locations.json").then((r) => r.json() as Promise<RawLocation[]>),
		fetch("./marker-svgs.json").then((r) => r.json() as Promise<Record<string, MarkerSvgEntry>>),
	]);
	return raw.map((loc) => ({
		id: String(loc.id),
		name: loc.name,
		position: [loc.lat, loc.lng],
		category: {
			iconName: loc.icon,
			iconVariant: loc.iconVariant,
			color: loc.color,
		},
		tags: loc.tags ?? [],
		markerSvg: markerSvgs[loc.name]?.src,
		markerSvgAspectRatio: markerSvgs[loc.name]?.aspectRatio,
		openingHours: loc.openingHours,
		aktiviteter: loc.aktiviteter,
	}));
}
