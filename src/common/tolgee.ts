import { BackendFetch, DevTools, FormatSimple, Tolgee } from "@tolgee/react";

export const AVAILABLE_LANGUAGES = ["sv", "en", "uk", "nl"];
const DEFAULT_LANGUAGE = "sv";

function readCookie(name: string): string | undefined {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : undefined;
}

function getInitialLanguage(): string {
	const cookieLanguage = readCookie("j26-language");
	return cookieLanguage && AVAILABLE_LANGUAGES.includes(cookieLanguage)
		? cookieLanguage
		: DEFAULT_LANGUAGE;
}

const backendFetchPrefix = import.meta.env
	.J26_PUBLIC_TOLGEE_BACKEND_FETCH_PREFIX;

// TolgeeProvider calls tolgee.run() on mount and renders children once loaded
// (or immediately, with untranslated keys, if loading fails).
export const tolgee = Tolgee()
	.use(
		BackendFetch(
			backendFetchPrefix ? { prefix: backendFetchPrefix } : undefined,
		),
	)
	.use(DevTools())
	.use(FormatSimple())
	.init({
		language: getInitialLanguage(),
		availableLanguages: AVAILABLE_LANGUAGES,
		defaultLanguage: DEFAULT_LANGUAGE,
		ns: ["map"],
		defaultNs: "map",

		// for development
		apiUrl: import.meta.env.J26_PUBLIC_TOLGEE_API_URL,
		apiKey: import.meta.env.J26_PUBLIC_TOLGEE_API_KEY,
		projectId: import.meta.env.J26_PUBLIC_TOLGEE_PROJECT_ID,
	});
