import type { PointTuple } from "leaflet";
import type { IconVariant } from "./icons";

export type Category = {
	iconName: string;
	iconVariant: IconVariant;
	color: string;
	/**
	 * Priority level controlling when the marker appears as zoom increases.
	 * 1 = always visible, 2 = visible from zoom 16, 3 = zoom 17, 4 = zoom 18 only.
	 */
	priority: 1 | 2 | 3 | 4;
};

export type Location = {
	id: string;
	name: string;
	position: PointTuple;
	category: Category;
};
