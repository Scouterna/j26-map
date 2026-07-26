// Build-time feature flags. Vite inlines these at build time, so flipping one
// requires a rebuild/redeploy — they're for turning features on and off per
// deployment, not at runtime.

// The "route to scene" button (opening ceremony paths). Enabled unless the env
// var is explicitly set to "false", so the feature can be switched off once the
// opening ceremony has passed.
export const SHOW_OPENING_PATHS_BUTTON =
	import.meta.env.J26_PUBLIC_SHOW_OPENING_PATHS_BUTTON !== "false";
