import { tolgee } from "./tolgee";

// Localized fields come back keyed by language code. We show Swedish when the
// UI is in Swedish, and fall back to English for every other locale.
export type LocalizedText = { sv: string; en: string };

export function pickLocalized(text: LocalizedText): string {
	return tolgee.getLanguage() === "sv" ? text.sv : text.en;
}
