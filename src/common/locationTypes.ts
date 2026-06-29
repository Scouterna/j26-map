import type { IconVariant } from "./icons";

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

export type Aktivitet = {
	id: string;
	name: string;
	from: string;
	to: string;
	description?: string;
};

export type Location = {
	id: string;
	name: string;
	position: PointTuple;
	category: Category;
	tags: string[];
	markerSvg?: string;
	markerSvgAspectRatio?: number;
	openingHours?: Record<string, OpeningHourSlot[]>;
	aktiviteter?: Record<string, Aktivitet[]>;
};
