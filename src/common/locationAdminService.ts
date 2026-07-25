import type { RawLocation } from "./locationTypes";

const BOOKING_API_BASE = "/_services/booking/api";

export type Me = {
	name: string;
	group_name: string | null;
	roles: string[];
};

// Roles that grant location management. `admin` implies every role server-side,
// but we check it explicitly so the client gate matches the server's behaviour.
const MANAGE_ROLES = ["activities:manage", "admin"];

export function canManageActivities(roles: string[]): boolean {
	return roles.some((role) => MANAGE_ROLES.includes(role));
}

// Fetch the current user (and their roles) for gating the edit UI. Returns null
// when unauthenticated (401) or on any failure — the app then treats the user as
// not permitted, which is the safe default. The server independently enforces the
// role on every write regardless of what the client shows.
export async function getMe(): Promise<Me | null> {
	try {
		const res = await fetch(`${BOOKING_API_BASE}/me`, {
			credentials: "include",
		});
		if (!res.ok) return null;
		return (await res.json()) as Me;
	} catch {
		return null;
	}
}

// Raw locations keyed by id, populated by getLocations(). Writes merge onto these
// so a full-replace PUT never drops the untouched language or opening_hours.
const rawCache = new Map<string, RawLocation>();

export function cacheRawLocation(loc: RawLocation): void {
	rawCache.set(loc.id, loc);
}

export function getRawLocation(id: string): RawLocation | undefined {
	return rawCache.get(id);
}

export class SaveLocationError extends Error {}

// Merge `patch` over the cached raw location and PUT the full record. Returns the
// server's fresh raw location and refreshes the cache. Throws SaveLocationError on
// any non-2xx response or missing cache entry.
export async function saveLocation(
	id: string,
	patch: Partial<RawLocation>,
): Promise<RawLocation> {
	const current = rawCache.get(id);
	if (!current) {
		throw new SaveLocationError(`No cached location for id ${id}`);
	}

	const merged: RawLocation = { ...current, ...patch, id };
	const body = {
		name: merged.name,
		description: merged.description,
		icon_name: merged.icon_name,
		icon_variant: merged.icon_variant,
		color: merged.color,
		latitude: merged.latitude,
		longitude: merged.longitude,
		opening_hours: merged.opening_hours ?? {},
		tags: merged.tags ?? [],
	};

	let res: Response;
	try {
		res = await fetch(`${BOOKING_API_BASE}/locations/${id}`, {
			method: "PUT",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch (err) {
		throw new SaveLocationError(
			err instanceof Error ? err.message : "Network error",
		);
	}

	if (!res.ok) {
		throw new SaveLocationError(`Save failed (${res.status})`);
	}

	const updated = (await res.json()) as RawLocation;
	rawCache.set(id, updated);
	return updated;
}
