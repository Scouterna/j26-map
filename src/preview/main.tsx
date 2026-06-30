import maplibregl from "maplibre-gl";
import { render } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { BaseLayers } from "../common/BaseLayers";
import { getIconURL } from "../common/icons";
import { type PointTuple, toLngLat } from "../common/locationTypes";
import { MapCanvas, useMap } from "../common/MapCanvas";
import { createMarkerElement } from "../common/marker";
import "../style.css";

type Props = {
	position: PointTuple;
	iconUrl?: string;
};

function TileLoadWatcher({ onLoaded }: { onLoaded: () => void }) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		if (map.loaded()) {
			requestAnimationFrame(onLoaded);
			return;
		}

		const handler = () => requestAnimationFrame(onLoaded);
		map.once("idle", handler);
		return () => map.off("idle", handler);
	}, [map, onLoaded]);

	return null;
}

function PreviewPin({ position, iconUrl }: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;
		const el = createMarkerElement("#059669", iconUrl);
		el.style.pointerEvents = "none";
		const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
			.setLngLat(toLngLat(position))
			.addTo(map);
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

	const center: PointTuple = [lat + 0.00015, lng];

	// Zoom so 70% of the campsite longitude span (0.042°) fills the viewport width.
	// Web mercator: pixels = degrees × 256 × 2^z / 360  →  z = log2(w × 360 / (span × 256))
	const CAMPSITE_LNG_SPAN = 14.157 - 14.115;
	const zoom =
		Math.log2((window.innerWidth * 360) / (CAMPSITE_LNG_SPAN * 0.7 * 256)) + 1;

	const [tilesLoaded, setTilesLoaded] = useState(false);
	const onLoaded = useCallback(() => setTilesLoaded(true), []);

	return (
		<div
			class={`w-screen h-dvh transition-opacity ${tilesLoaded ? "" : "opacity-0"}`}
		>
			<MapCanvas interactive={false} osmTiles={false} attribution={false} center={center} zoom={zoom}>
				<BaseLayers />
				<TileLoadWatcher onLoaded={onLoaded} />
				<PreviewPin position={[lat, lng]} iconUrl={iconUrl} />
			</MapCanvas>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: It's guaranteed to be there.
render(<PreviewApp />, document.getElementById("app")!);
