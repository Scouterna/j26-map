import type { ZoomAnimEvent } from "leaflet";
import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

type Props = {
	name: string;
	zIndex: number;
	/** Fade out when zoom reaches this level */
	hideAtZoom?: number;
	/** Fade in when zoom reaches this level */
	showAtZoom?: number;
	/** Fade in and out at the start of zoom instead of waiting for zoomend to fade in */
	eagerFade?: boolean;
};

export function MapPane({ name, zIndex, hideAtZoom, showAtZoom, eagerFade }: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;
		const mapRef = map;
		const pane = mapRef.createPane(name);
		pane.style.zIndex = String(zIndex);

		if (hideAtZoom !== undefined || showAtZoom !== undefined) {
			pane.style.transition = "opacity 250ms";

			function setOpacity(zoom: number) {
				const hidden =
					(hideAtZoom !== undefined && zoom >= hideAtZoom) ||
					(showAtZoom !== undefined && zoom < showAtZoom);
				pane.style.opacity = hidden ? "0" : "1";
			}

			function onZoomAnim(e: ZoomAnimEvent) {
				if (eagerFade) {
					setOpacity(e.zoom);
				} else {
					const hidden =
						(hideAtZoom !== undefined && e.zoom >= hideAtZoom) ||
						(showAtZoom !== undefined && e.zoom < showAtZoom);
					if (hidden) pane.style.opacity = "0";
				}
			}

			function onZoomEnd() {
				setOpacity(mapRef.getZoom());
			}

			setOpacity(mapRef.getZoom());
			mapRef.on("zoomanim", onZoomAnim);
			mapRef.on("zoomend", onZoomEnd);

			return () => {
				mapRef.off("zoomanim", onZoomAnim);
				mapRef.off("zoomend", onZoomEnd);
				pane.remove();
			};
		}

		return () => {
			pane.remove();
		};
	}, [map, name, zIndex, hideAtZoom, showAtZoom, eagerFade]);

	return null;
}
