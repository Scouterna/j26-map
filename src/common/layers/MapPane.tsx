import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

type Props = {
	name: string;
	zIndex: number;
	/** Fade out when zoom reaches this level */
	hideAtZoom?: number;
	/** Fade in when zoom reaches this level */
	showAtZoom?: number;
};

export function MapPane({ name, zIndex, hideAtZoom, showAtZoom }: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;
		const mapRef = map;
		const pane = mapRef.createPane(name);
		pane.style.zIndex = String(zIndex);

		if (hideAtZoom !== undefined || showAtZoom !== undefined) {
			pane.style.transition = "opacity 250ms";

			function updateOpacity() {
				const zoom = mapRef.getZoom();
				const hidden =
					(hideAtZoom !== undefined && zoom >= hideAtZoom) ||
					(showAtZoom !== undefined && zoom < showAtZoom);
				pane.style.opacity = hidden ? "0" : "1";
			}

			updateOpacity();
			mapRef.on("zoomend", updateOpacity);

			return () => {
				mapRef.off("zoomend", updateOpacity);
				pane.remove();
			};
		}

		return () => {
			pane.remove();
		};
	}, [map, name, zIndex, hideAtZoom, showAtZoom]);

	return null;
}
