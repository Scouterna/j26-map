import { type LocalizedText, pickLocalized } from "./localized";

const BOOKING_API_BASE = "/_services/booking/api";

type RawLocationTag = {
	id: string;
	name: LocalizedText;
	icon_name: string;
	icon_variant: string;
};

type LocationTagsResponse = { location_tags: RawLocationTag[] };

let tagNamesPromise: Promise<Map<string, string>> | null = null;

async function fetchTagNames(): Promise<Map<string, string>> {
	const { location_tags } = await fetch(
		`${BOOKING_API_BASE}/location-tags`,
	).then((r) => r.json() as Promise<LocationTagsResponse>);
	return new Map(location_tags.map((tag) => [tag.id, pickLocalized(tag.name)]));
}

// Maps tag id → localized display name.
export function getLocationTagNames(): Promise<Map<string, string>> {
	if (!tagNamesPromise) tagNamesPromise = fetchTagNames();
	return tagNamesPromise;
}
