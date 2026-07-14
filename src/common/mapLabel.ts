import { tolgee } from "./tolgee";

// QGIS-sourced map labels (program-area and district names) are localized through
// Tolgee, unlike booking-API data which carries {sv,en} inline. The map data's
// `name` field holds a SLUG (e.g. "riktningens-borg") — set in QGIS for program
// areas and in scripts/districts.meta.json for districts — which is the key
// segment: mapLabels.<type>.<slug>. When a translation is missing we fall back to
// a title-cased version of the slug ("Riktningens Borg").

export type MapLabelType = "program" | "district";

// Defensive normalization: the name field should already be a slug, but this also
// tolerates a stray capital / space / diacritic so the key still resolves.
function slug(name: string): string {
	return name
		.toLowerCase()
		.replace(/å/g, "a")
		.replace(/ä/g, "a")
		.replace(/ö/g, "o")
		.replace(/é/g, "e")
		.replace(/ü/g, "u")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function titleCase(s: string): string {
	return s
		.split("-")
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

export function mapLabelKey(type: MapLabelType, name: string): string {
	return `mapLabels.${type}.${slug(name)}`;
}

// Human-readable fallback shown when a translation key is missing.
export function mapLabelFallback(name: string): string {
	return titleCase(slug(name));
}

// Imperative lookup for non-React callers (the search index). React components
// should use their `useTranslate` t with mapLabelKey()/mapLabelFallback() so they
// re-render on a language change. Call loadMapLabels() first so this doesn't
// return the fallback before Tolgee has loaded.
export function translateMapLabel(type: MapLabelType, name: string): string {
	return tolgee.t(mapLabelKey(type, name), mapLabelFallback(name));
}

// Await Tolgee's initial load so translateMapLabel returns localized strings
// rather than the fallback. Safe whether or not the provider has started Tolgee
// yet, and a no-op once the map namespace is loaded.
export function loadMapLabels(): Promise<unknown> {
	return tolgee.isRunning() ? tolgee.loadRequired() : tolgee.run();
}
