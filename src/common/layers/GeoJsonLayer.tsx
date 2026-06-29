import type {
	ExpressionSpecification,
	FillLayerSpecification,
	LineLayerSpecification,
} from "maplibre-gl";
import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";


const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

type LayerStyle = {
	color?: string;
	weight?: number;
	opacity?: number;
	fillColor?: string;
	fillOpacity?: number | ExpressionSpecification;
	lineCap?: "butt" | "round" | "square";
	fill?: boolean;
};

type Props = {
	id: string;
	src: string;
	style?: LayerStyle;
	geoScale?: boolean;
	weightAttribute?: string;
	weightOffset?: number;
	patternDef?: string;
	colorAttribute?: string;
	fillColorAttribute?: string;
	maxzoom?: number;
	minzoom?: number;
};

async function renderPattern(
	patternDef: string,
): Promise<{ imageData: ImageData; id: string }> {
	const ns = "http://www.w3.org/2000/svg";
	const doc = new DOMParser().parseFromString(
		`<svg xmlns="${ns}">${patternDef}</svg>`,
		"image/svg+xml",
	);
	const pattern = doc.querySelector("pattern");
	if (!pattern) throw new Error("No pattern element");

	const pid = pattern.getAttribute("id") ?? "pattern";
	const w = parseFloat(pattern.getAttribute("width") ?? "256");
	const h = parseFloat(pattern.getAttribute("height") ?? "256");

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d")!;

	for (const child of Array.from(pattern.children)) {
		if (child.tagName === "rect") {
			ctx.fillStyle = child.getAttribute("fill") ?? "transparent";
			ctx.fillRect(
				parseFloat(child.getAttribute("x") ?? "0"),
				parseFloat(child.getAttribute("y") ?? "0"),
				parseFloat(child.getAttribute("width") ?? String(w)),
				parseFloat(child.getAttribute("height") ?? String(h)),
			);
		} else if (child.tagName === "image") {
			const href = child.getAttribute("href") ?? "";
			const opacity = parseFloat(child.getAttribute("opacity") ?? "1");
			const iw = parseFloat(child.getAttribute("width") ?? String(w));
			const ih = parseFloat(child.getAttribute("height") ?? String(h));
			if (href) {
				try {
					const img = await new Promise<HTMLImageElement>((resolve, reject) => {
						const el = new Image();
						el.onload = () => resolve(el);
						el.onerror = reject;
						el.src = href;
					});
					ctx.globalAlpha = opacity;
					ctx.drawImage(img, 0, 0, iw, ih);
					ctx.globalAlpha = 1;
				} catch {
					// fall back to background color
				}
			}
		}
	}

	return { imageData: ctx.getImageData(0, 0, w, h), id: pid };
}

function buildFillPaint(
	style: LayerStyle | undefined,
	fillColorAttribute: string | undefined,
): FillLayerSpecification["paint"] {
	const paint: FillLayerSpecification["paint"] = {};
	if (fillColorAttribute) {
		paint["fill-color"] = [
			"coalesce",
			["get", fillColorAttribute],
			"#888888",
		] as ExpressionSpecification;
	} else if (
		style?.fillColor &&
		style.fillColor !== "transparent" &&
		!style.fillColor.startsWith("url(")
	) {
		paint["fill-color"] = style.fillColor;
	}
	if (style?.fillOpacity !== undefined) {
		paint["fill-opacity"] = style.fillOpacity;
	}
	return paint;
}

function buildLinePaint(
	style: LayerStyle | undefined,
	colorAttribute: string | undefined,
	geoScale: boolean | undefined,
	weightAttribute: string | undefined,
	weightOffset: number,
): LineLayerSpecification["paint"] {
	const paint: LineLayerSpecification["paint"] = {};

	if (colorAttribute) {
		paint["line-color"] = [
			"coalesce",
			["get", colorAttribute],
			"#000000",
		] as ExpressionSpecification;
	} else if (style?.color && style.color !== "transparent") {
		paint["line-color"] = style.color;
	}

	if (style?.opacity !== undefined) {
		paint["line-opacity"] = style.opacity;
	}

	const baseWeight = style?.weight ?? 3;
	if (geoScale) {
		if (weightAttribute) {
			// Composite expression: ["zoom"] must be input to the outermost interpolate.
			const dataWidth: ExpressionSpecification = [
				"+",
				["*", baseWeight, ["coalesce", ["get", weightAttribute], 1]],
				weightOffset,
			];
			paint["line-width"] = [
				"interpolate", ["exponential", 2], ["zoom"],
				12, ["*", dataWidth, 0.0221],
				20, ["*", dataWidth, 5.6569],
			] as ExpressionSpecification;
		} else {
			const w = baseWeight + weightOffset;
			paint["line-width"] = [
				"interpolate", ["exponential", 2], ["zoom"],
				12, w * 0.0221,
				20, w * 5.6569,
			] as ExpressionSpecification;
		}
	} else {
		paint["line-width"] = baseWeight;
	}

	return paint;
}

export function GeoJsonLayer({
	id,
	src,
	style,
	geoScale,
	weightAttribute,
	weightOffset = 0,
	patternDef,
	colorAttribute,
	fillColorAttribute,
	maxzoom,
	minzoom,
}: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		const fillId = `${id}-fill`;
		const lineId = `${id}-line`;

		const needsFill =
			(style?.fillOpacity ?? 0) > 0 || !!fillColorAttribute || !!patternDef;
		const needsLine =
			style?.color !== "transparent" &&
			(style?.weight === undefined || style.weight > 0);

		// Add source with empty data synchronously so layer order is deterministic
		map.addSource(id, { type: "geojson", data: EMPTY_FC });

		if (needsFill) {
			const fillPaint = buildFillPaint(style, fillColorAttribute);
			const fillSpec: FillLayerSpecification = {
				id: fillId,
				type: "fill",
				source: id,
				paint: fillPaint,
			};
			if (maxzoom !== undefined) fillSpec.maxzoom = maxzoom;
			if (minzoom !== undefined) fillSpec.minzoom = minzoom;
			map.addLayer(fillSpec);
		}

		if (needsLine) {
			const linePaint = buildLinePaint(
				style,
				colorAttribute,
				geoScale,
				weightAttribute,
				weightOffset,
			);
			const lineLayout: LineLayerSpecification["layout"] = {};
			if (style?.lineCap) lineLayout["line-cap"] = style.lineCap;
			const lineSpec: LineLayerSpecification = {
				id: lineId,
				type: "line",
				source: id,
				paint: linePaint,
				layout: lineLayout,
			};
			if (maxzoom !== undefined) lineSpec.maxzoom = maxzoom;
			if (minzoom !== undefined) lineSpec.minzoom = minzoom;
			map.addLayer(lineSpec);
		}

		let cancelled = false;
		let addedImageId: string | undefined;

		async function loadData() {
			if (patternDef && needsFill) {
				try {
					const { imageData, id: pid } = await renderPattern(patternDef);
					if (cancelled) return;
					if (!map.hasImage(pid)) {
						map.addImage(pid, imageData);
						addedImageId = pid;
					}
					map.setPaintProperty(fillId, "fill-pattern", pid);
				} catch {
					// keep solid fill color as fallback
				}
			}

			const data = await fetch(src).then((r) => r.json());
			if (cancelled) return;
			(map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
		}

		loadData();

		return () => {
			cancelled = true;
			if (needsLine && map.getLayer(lineId)) map.removeLayer(lineId);
			if (needsFill && map.getLayer(fillId)) map.removeLayer(fillId);
			if (map.getSource(id)) map.removeSource(id);
			if (addedImageId && map.hasImage(addedImageId)) map.removeImage(addedImageId);
		};
	}, [map]);

	return null;
}
