import type { IconVariant } from "./icons";
import type { LocalizedText } from "./localized";

export type PointTuple = [lat: number, lng: number];

export function toLngLat(pt: PointTuple): [number, number] {
	return [pt[1], pt[0]];
}

export type Category = {
	iconName: string;
	iconVariant: IconVariant;
	color: string;
};

export type OpeningHourSlot = { from: string; to: string };

// Raw location shape as returned by (and sent to) the booking API. Unlike
// `Location`, name/description are bilingual objects and coordinates are flat,
// nullable top-level fields. Writes are built from this shape because the API's
// PUT is a full replace — every field must round-trip, including the language
// not being edited and `opening_hours` (which the map never edits).
export type RawLocation = {
	id: string;
	name: LocalizedText;
	description: LocalizedText;
	icon_name: string;
	icon_variant: IconVariant;
	color: string;
	latitude: number | null;
	longitude: number | null;
	opening_hours?: Record<string, OpeningHourSlot[]>;
	tags?: string[];
};

export type Location = {
	id: string;
	name: string;
	description: string;
	position: PointTuple;
	category: Category;
	tags: string[];
	markerSvg?: string;
	markerSvgAspectRatio?: number;
	openingHours?: Record<string, OpeningHourSlot[]>;
};
