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

export type Location = {
	id: string;
	name: string;
	position: PointTuple;
	category: Category;
	tags: string[];
};
