import { mockLocations } from "./mockLocations";
import type { Location } from "./locationTypes";

export async function getLocations(): Promise<Location[]> {
	return mockLocations;
}
