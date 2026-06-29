type ScoutGroup = { name: string; village: string };

let promise: Promise<ScoutGroup[]> | null = null;

function getAll(): Promise<ScoutGroup[]> {
	if (!promise) promise = fetch("./scout-groups.json").then((r) => r.json());
	return promise;
}

export async function getGroupsForVillage(villageNumber: string): Promise<string[]> {
	const groups = await getAll();
	return groups.filter((g) => g.village === villageNumber).map((g) => g.name);
}
