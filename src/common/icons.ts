export type IconVariant = "filled" | "outline";

const TABLER_PREFIX = "tabler-";
const J26_ICON_PREFIX = "j26-icon-";
const J26_LOGO_PREFIX = "j26-logo-";

function sanitizeIconSegment(iconName: string) {
	return iconName.replace(/[^a-z0-9_-]/gi, "");
}

// icon_name from the booking API is prefixed by source: tabler-* pulls from the
// Tabler CDN, j26-icon-* from public/icons, j26-logo-* from public/logos.
export function getIconURL(iconName: string, variant: IconVariant = "outline") {
	if (iconName.startsWith(J26_ICON_PREFIX)) {
		return `./icons/${sanitizeIconSegment(iconName.slice(J26_ICON_PREFIX.length))}.svg`;
	}
	if (iconName.startsWith(J26_LOGO_PREFIX)) {
		return `./logos/${sanitizeIconSegment(iconName.slice(J26_LOGO_PREFIX.length))}.svg`;
	}

	const bareName = iconName.startsWith(TABLER_PREFIX)
		? iconName.slice(TABLER_PREFIX.length)
		: iconName;
	const sanitizedIconName = sanitizeIconSegment(bareName);
	const sanitizedVariant = sanitizeIconSegment(variant);

	return `https://unpkg.com/@tabler/icons/icons/${sanitizedVariant}/${sanitizedIconName}.svg`;
}
