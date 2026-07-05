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
