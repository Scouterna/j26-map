import type { IconVariant } from "./icons";
import type { Location, OpeningHourSlot } from "./locationTypes";

const BOOKING_API_BASE = "/_services/booking/api";
const J26_LOGO_PREFIX = "j26-logo-";

type RawLocation = {
	id: string;
	name: string;
	icon_name: string;
	icon_variant: IconVariant;
	color: string;
	latitude: number;
	longitude: number;
	opening_hours?: Record<string, OpeningHourSlot[]>;
	tags?: string[];
};

type LocationsResponse = { locations: RawLocation[] };

// Aspect ratios for j26-logo-* markers, keyed by the logo filename (without extension).
// The API only gives us the icon_name/prefix — the actual SVG dimensions have to be
// supplied locally since they're not part of the booking data.
type LogoEntry = { src: string; aspectRatio: number };

export async function getLocations(): Promise<Location[]> {
	const [{ locations }, logos] = await Promise.all([
		fetch(`${BOOKING_API_BASE}/locations`).then(
			(r) => r.json() as Promise<LocationsResponse>,
		),
		fetch("./logos.json").then(
			(r) => r.json() as Promise<Record<string, LogoEntry>>,
		),
	]);

	return locations
		.filter((loc) => loc.latitude !== 0 || loc.longitude !== 0)
		.map((loc) => {
			const logoKey = loc.icon_name.startsWith(J26_LOGO_PREFIX)
				? loc.icon_name.slice(J26_LOGO_PREFIX.length)
				: undefined;
			const logo = logoKey ? logos[logoKey] : undefined;

			return {
				id: loc.id,
				name: loc.name,
				position: [loc.latitude, loc.longitude],
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
		});
}
