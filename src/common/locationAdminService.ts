import type { IconVariant } from "./icons";
import type { LocalizedText } from "./localized";
import type { OpeningHourSlot, RawLocation } from "./locationTypes";

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

// The writable fields of a location, as accepted by the booking API's
// LocationInput schema. Coordinates are all-or-nothing server-side: send both
// or neither, never one.
export type LocationInput = {
	name: LocalizedText;
	description: LocalizedText;
	icon_name: string;
	icon_variant: IconVariant;
	color: string;
	latitude: number | null;
	longitude: number | null;
	opening_hours: Record<string, OpeningHourSlot[]>;
	tags: string[];
};

// POST a brand-new location and cache the created record so subsequent edits
// (which PUT a full replace built from the cache) work without a refetch.
export async function createLocation(
	input: LocationInput,
): Promise<RawLocation> {
	let res: Response;
	try {
		res = await fetch(`${BOOKING_API_BASE}/locations`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		});
	} catch (err) {
		throw new SaveLocationError(
			err instanceof Error ? err.message : "Network error",
		);
	}

	if (!res.ok) {
		throw new SaveLocationError(`Create failed (${res.status})`);
	}

	const created = (await res.json()) as RawLocation;
	rawCache.set(created.id, created);
	return created;
}

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

// Permanently delete a location (and its tag links) server-side. Resolves on the
// API's 204; drops the cache entry so a stale record can't be resurrected by a
// later PUT. Throws SaveLocationError on any non-2xx.
export async function deleteLocation(id: string): Promise<void> {
	let res: Response;
	try {
		res = await fetch(`${BOOKING_API_BASE}/locations/${id}`, {
			method: "DELETE",
			credentials: "include",
		});
	} catch (err) {
		throw new SaveLocationError(
			err instanceof Error ? err.message : "Network error",
		);
	}

	if (!res.ok) {
		throw new SaveLocationError(`Delete failed (${res.status})`);
	}

	rawCache.delete(id);
}
