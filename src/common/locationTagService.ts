import { type LocalizedText, pickLocalized } from "./localized";

const BOOKING_API_BASE = "/_services/booking/api";

type RawLocationTag = {
	id: string;
	name: LocalizedText;
	icon_name: string;
	icon_variant: string;
};

type LocationTagsResponse = { location_tags: RawLocationTag[] };

// A tag with its display name resolved to the current language.
export type LocationTag = { id: string; name: string };

let tagsPromise: Promise<RawLocationTag[]> | null = null;

function fetchTags(): Promise<RawLocationTag[]> {
	return fetch(`${BOOKING_API_BASE}/location-tags`)
		.then((r) => r.json() as Promise<LocationTagsResponse>)
		.then((res) => res.location_tags);
}

function getRawTags(): Promise<RawLocationTag[]> {
	if (!tagsPromise) tagsPromise = fetchTags();
	return tagsPromise;
}

// Maps tag id → localized display name.
export async function getLocationTagNames(): Promise<Map<string, string>> {
	const tags = await getRawTags();
	return new Map(tags.map((tag) => [tag.id, pickLocalized(tag.name)]));
}

// Full tag list (id + localized name) for building a tag selector.
export async function getLocationTags(): Promise<LocationTag[]> {
	const tags = await getRawTags();
	return tags.map((tag) => ({ id: tag.id, name: pickLocalized(tag.name) }));
}
