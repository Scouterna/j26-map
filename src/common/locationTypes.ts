import type { PointTuple } from "leaflet";
import type { IconVariant } from "./icons";

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
