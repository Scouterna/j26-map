import { pickLocalized } from "./localized";
import { cacheRawLocation } from "./locationAdminService";
import type { Location, RawLocation } from "./locationTypes";

const BOOKING_API_BASE = "/_services/booking/api";
const J26_LOGO_PREFIX = "j26-logo-";

type LocationsResponse = { locations: RawLocation[] };

// Aspect ratios for j26-logo-* markers, keyed by the logo filename (without extension).
// The API only gives us the icon_name/prefix — the actual SVG dimensions have to be
// supplied locally since they're not part of the booking data.
type LogoEntry = { src: string; aspectRatio: number };

let logosPromise: Promise<Record<string, LogoEntry>> | null = null;

function getLogos(): Promise<Record<string, LogoEntry>> {
	if (!logosPromise) {
		logosPromise = fetch("./logos.json").then(
			(r) => r.json() as Promise<Record<string, LogoEntry>>,
		);
	}
	return logosPromise;
}

// Transform a raw booking-API location into the app's display `Location`.
// Exported so edits (which return a raw object) can be re-projected without a refetch.
export function toLocation(
	loc: RawLocation,
	logos: Record<string, LogoEntry>,
): Location {
	const logoKey = loc.icon_name.startsWith(J26_LOGO_PREFIX)
		? loc.icon_name.slice(J26_LOGO_PREFIX.length)
		: undefined;
	const logo = logoKey ? logos[logoKey] : undefined;

	return {
		id: loc.id,
		name: pickLocalized(loc.name),
		description: pickLocalized(loc.description),
		position: [loc.latitude ?? 0, loc.longitude ?? 0],
		category: {
			iconName: loc.icon_name,
			iconVariant: loc.icon_variant,
			color: loc.color,
		},
		tags: loc.tags ?? [],
		markerSvg: logo?.src,
		markerSvgAspectRatio: logo?.aspectRatio,
		openingHours: loc.opening_hours,
	};
}

// Re-project a single raw location using the (already loaded) logo map. Awaits the
// shared logos promise, which resolves immediately after the initial getLocations().
export async function rawToLocation(loc: RawLocation): Promise<Location> {
	return toLocation(loc, await getLogos());
}

function hasCoordinates(loc: RawLocation): boolean {
	return (
		loc.latitude != null &&
		loc.longitude != null &&
		(loc.latitude !== 0 || loc.longitude !== 0)
	);
}

export async function getLocations(): Promise<Location[]> {
	const [{ locations }, logos] = await Promise.all([
		fetch(`${BOOKING_API_BASE}/locations`).then(
			(r) => r.json() as Promise<LocationsResponse>,
		),
		getLogos(),
	]);

	// Cache every raw location (even coordinate-less ones) so writes can build a
	// full-replace PUT body from the authoritative bilingual source.
	for (const loc of locations) cacheRawLocation(loc);

	return locations.filter(hasCoordinates).map((loc) => toLocation(loc, logos));
}
