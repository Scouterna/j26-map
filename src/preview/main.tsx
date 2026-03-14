import { Marker, type PointTuple } from "leaflet";
import { render } from "preact";
import { useEffect } from "preact/hooks";
import { MapCanvas, useMap } from "../common/MapCanvas";
import { createMarkerIcon } from "../common/marker";
import "../style.css";
import { getIconURL } from "../common/icons";

export type Props = {
	position: PointTuple;
	iconUrl?: string;
};

function PreviewPin({ position, iconUrl }: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;
		const marker = new Marker(position, {
			icon: createMarkerIcon("blue", iconUrl),
			interactive: false,
		}).addTo(map);
		return () => {
			marker.remove();
		};
	}, [map, position, iconUrl]);

	return null;
}

function PreviewApp() {
	const params = new URLSearchParams(window.location.search);
	const lat = parseFloat(params.get("lat") ?? "");
	const lng = parseFloat(params.get("lng") ?? "");

	const icon = params.get("icon");
	const iconVariant = params.get("variant") as "filled" | "outline" | null;

	const iconUrl = icon ? getIconURL(icon, iconVariant ?? undefined) : undefined;

	if (Number.isNaN(lat) || Number.isNaN(lng)) {
		return (
			<div class="flex flex-col items-center justify-center h-screen gap-4 p-4">
				<h1 class="text-2xl font-bold">Invalid coordinates</h1>
				<p>
					Please provide valid coordinates, e.g.{" "}
					<code>?lat=55.58071&lng=14.13704</code>.
				</p>
			</div>
		);
	}

	// Shift center slightly north so the pin isn't hidden behind the top edge
	const center: PointTuple = [lat + 0.00025, lng];

	return (
		<div class="w-screen h-dvh">
			<MapCanvas interactive={false} center={center}>
				<PreviewPin position={[lat, lng]} iconUrl={iconUrl} />
			</MapCanvas>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<PreviewApp />, document.getElementById("app")!);
