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

const maskUrlCache = new Map<string, Promise<string | null>>();

// Turn an icon URL into one that's safe to use as a CSS `mask-image`. Same-origin
// URLs are returned unchanged; cross-origin ones (the Tabler CDN) are fetched and
// returned as a data: URI, because iOS/WebKit refuses to APPLY a cross-origin
// mask-image (the fetch itself is fine — unpkg sends `Access-Control-Allow-Origin: *`).
// Returns null if the fetch fails. Results are cached per URL.
export function toMaskSafeUrl(url: string): Promise<string | null> {
	if (!/^https?:\/\//i.test(url)) return Promise.resolve(url);
	let cached = maskUrlCache.get(url);
	if (!cached) {
		cached = fetch(url)
			.then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
			.then((svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`)
			.catch(() => null);
		maskUrlCache.set(url, cached);
	}
	return cached;
}

/** Mask-safe icon URL (see toMaskSafeUrl) for use as a marker's `mask-image`. */
export function getIconMaskUrl(
	iconName: string,
	variant: IconVariant = "outline",
): Promise<string | null> {
	return toMaskSafeUrl(getIconURL(iconName, variant));
}
