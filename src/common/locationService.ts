import { pickLocalized } from "./localized";
import { cacheRawLocation, getRawLocation } from "./locationAdminService";
import type { Location, RawLocation } from "./locationTypes";
import { layerUrl } from "./mapLayers";

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

function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * Match a display `Location` against a Swedish name. Resolves through the raw
 * cache so the match holds whatever language the UI is in, falling back to the
 * displayed name if the raw entry is missing.
 */
export function hasSwedishName(loc: Location, swedishName: string): boolean {
	const raw = getRawLocation(loc.id);
	const name = raw?.name.sv ?? loc.name;
	return normalizeName(name) === normalizeName(swedishName);
}

// The squares layer draws a named town-square outline over a cluster of pins.
// One pin per square carries that same (Swedish) name and is redundant with the
// square's own label, so it's hidden. Matched on the raw `name.sv` — the square
// names are Swedish — so it holds regardless of the UI language.
let squareNamesPromise: Promise<Set<string>> | null = null;
function getSquareNames(): Promise<Set<string>> {
	if (!squareNamesPromise) {
		squareNamesPromise = Promise.resolve()
			.then(() => fetch(layerUrl("squares")))
			.then(
				(r) =>
					r.json() as Promise<{
						features: { properties: { name?: string } }[];
					}>,
			)
			.then(
				(geojson) =>
					new Set(
						geojson.features
							.map((f) => f.properties.name)
							.filter((n): n is string => !!n)
							.map(normalizeName),
					),
			)
			.catch(() => new Set<string>());
	}
	return squareNamesPromise;
}

export async function getLocations(): Promise<Location[]> {
	const [{ locations }, logos, squareNames] = await Promise.all([
		fetch(`${BOOKING_API_BASE}/locations`).then(
			(r) => r.json() as Promise<LocationsResponse>,
		),
		getLogos(),
		getSquareNames(),
	]);

	// Cache every raw location (even coordinate-less ones) so writes can build a
	// full-replace PUT body from the authoritative bilingual source.
	for (const loc of locations) cacheRawLocation(loc);

	return locations
		.filter(hasCoordinates)
		.filter((loc) => !squareNames.has(normalizeName(loc.name.sv)))
		.map((loc) => toLocation(loc, logos));
}
