// Z-ordering in MapLibre is handled by layer insertion order (GeoJSON layers)
// and z-index on DOM markers. This component is intentionally a no-op.
export function MapPane(_props: {
	name: string;
	zIndex: number;
	hideAtZoom?: number;
	showAtZoom?: number;
}) {
	return null;
}
