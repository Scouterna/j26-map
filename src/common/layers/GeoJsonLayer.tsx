import { geoJSON, type PathOptions } from "leaflet";
import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

const GEO_SCALE_BASE_ZOOM = 17.5;

type Props = {
	src: string;
	style?: PathOptions;
	/** If true, weight scales with zoom so the line covers a fixed geographic area */
	geoScale?: boolean;
	/** Feature property to use as a weight multiplier (default: 1) */
	weightAttribute?: string;
	/** Fixed pixel amount added to the computed weight, unaffected by scaling */
	weightOffset?: number;
};

export function GeoJsonLayer({ src, style, geoScale, weightAttribute, weightOffset = 0 }: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		let cancelled = false;
		let layer: ReturnType<typeof geoJSON> | undefined;
		const baseWeight = style?.weight ?? 3;

		function getScaledStyle(widthMultiplier = 1): PathOptions {
			const scale = geoScale ? 2 ** (map!.getZoom() - GEO_SCALE_BASE_ZOOM) : 1;
			return { ...style, weight: (baseWeight * widthMultiplier + weightOffset) * scale };
		}

		fetch(src)
			.then((res) => res.json())
			.then((data) => {
				if (cancelled) return;
				layer = geoJSON(data, {
					style: weightAttribute
						? (feature) => getScaledStyle((feature?.properties as Record<string, unknown>)?.[weightAttribute] as number ?? 1)
						: getScaledStyle(),
				}).addTo(map!);
			});

		function onZoom() {
			layer?.setStyle((feature) =>
				getScaledStyle(weightAttribute ? (feature?.properties as Record<string, unknown>)?.[weightAttribute] as number ?? 1 : undefined),
			);
		}

		if (geoScale) map.on("zoom", onZoom);

		return () => {
			cancelled = true;
			layer?.remove();
			map.off("zoom", onZoom);
		};
	}, [map, src, style, geoScale, weightAttribute]);

	return null;
}
