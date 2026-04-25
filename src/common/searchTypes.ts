import type { Feature } from "geojson";
import type { Location } from "./locationTypes";

export type SearchResultLocation = {
	type: "location";
	location: Location;
};

export type SearchResultGroup = {
	type: "group";
	tag: string;
	displayName: string;
	locations: Location[];
};

export type SearchResultVillage = {
	type: "village";
	villageNumber: string;
	labelPoint: [number, number];
	polygon: Feature | null;
};

export type SearchResultDistrict = {
	type: "district";
	name: string;
	feature: Feature;
};

export type SearchResult =
	| SearchResultLocation
	| SearchResultGroup
	| SearchResultVillage
	| SearchResultDistrict;
