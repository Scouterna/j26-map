import { Canvas, SVG, geoJSON, type PathOptions } from "leaflet";
import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

const GEO_SCALE_BASE_ZOOM = 17.5;

async function rasterizePatternImages(defs: SVGDefsElement) {
	for (const img of Array.from(defs.querySelectorAll("image"))) {
		const href = img.getAttribute("href") ?? "";
		if (!href || href.startsWith("data:")) continue;
		try {
			const w = parseFloat(img.getAttribute("width") ?? "256");
			const h = parseFloat(img.getAttribute("height") ?? "256");
			const image = await new Promise<HTMLImageElement>((resolve, reject) => {
				const el = new Image(w, h);
				el.onload = () => resolve(el);
				el.onerror = reject;
				el.src = href;
			});
			const canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			if (!ctx) continue;
			ctx.drawImage(image, 0, 0, w, h);
			img.setAttribute("href", canvas.toDataURL("image/png"));
		} catch {
			// fall back to original SVG reference
		}
	}
}

type Props = {
	src: string;
	style?: PathOptions;
	/** If true, weight scales with zoom so the line covers a fixed geographic area */
	geoScale?: boolean;
	/** Feature property to use as a weight multiplier (default: 1) */
	weightAttribute?: string;
	/** Fixed pixel amount added to the computed weight, unaffected by scaling */
	weightOffset?: number;
	/** Leaflet path simplification factor; 0 = no simplification (default: 1) */
	smoothFactor?: number;
	/** SVG renderer padding as a fraction of map size (default: 0.1) */
	svgPadding?: number;
	/** SVG <pattern> element string; injected into a hidden body-level SVG so url(#id) resolves across all renderers */
	patternDef?: string;
	/** Leaflet pane name; controls z-ordering relative to other layers */
	pane: string;
	/** Feature property to use as stroke color */
	colorAttribute?: string;
	/** Feature property to use as fillColor */
	fillColorAttribute?: string;
	/** Use Canvas renderer instead of SVG; faster for many polygons on mobile */
	useCanvas?: boolean;
};

export function GeoJsonLayer({
	src,
	style,
	geoScale,
	weightAttribute,
	weightOffset = 0,
	smoothFactor,
	svgPadding,
	patternDef,
	pane,
	colorAttribute,
	fillColorAttribute,
	useCanvas,
}: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;
		const m = map;

		let cancelled = false;
		let layer: ReturnType<typeof geoJSON> | undefined;
		let patternHolder: SVGSVGElement | undefined;
		const baseWeight = style?.weight ?? 3;

		function getFeatureStyle(feature?: unknown, widthMultiplier = 1): PathOptions {
			const props = (feature as { properties?: Record<string, unknown> })?.properties ?? {};
			const scale = geoScale ? 2 ** (m.getZoom() - GEO_SCALE_BASE_ZOOM) : 1;
			return {
				...style,
				weight: (baseWeight * widthMultiplier + weightOffset) * scale,
				...(colorAttribute && props[colorAttribute] ? { color: props[colorAttribute] as string } : {}),
				...(fillColorAttribute && props[fillColorAttribute] ? { fillColor: props[fillColorAttribute] as string } : {}),
			};
		}

		fetch(src)
			.then((res) => res.json())
			.then((data) => {
				if (cancelled) return;

				layer = geoJSON(data, {
					// smoothFactor is a PolylineOptions property missing from GeoJSONOptions typings
					...(smoothFactor !== undefined && ({ smoothFactor } as object)),
					...(pane && { pane }),
					...(useCanvas && { renderer: new Canvas({ padding: 0.5, ...(pane && { pane }) }) }),
					...(svgPadding !== undefined && { renderer: new SVG({ padding: svgPadding, ...(pane && { pane }) }) }),
					style: (feature) =>
						getFeatureStyle(
							feature,
							weightAttribute
								? ((feature?.properties as Record<string, unknown>)?.[weightAttribute] as number) ?? 1
								: 1,
						),
				}).addTo(m);

				if (patternDef) {
					// Inject into a hidden <svg> at document body level so url(#id) resolves
					// across all SVG elements in the document, regardless of which Leaflet renderer
					// owns the path.
					const ns = "http://www.w3.org/2000/svg";
					patternHolder = document.createElementNS(ns, "svg") as SVGSVGElement;
					patternHolder.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
					patternHolder.setAttribute("aria-hidden", "true");
					const defs = document.createElementNS(ns, "defs") as SVGDefsElement;
					patternHolder.appendChild(defs);
					document.body.appendChild(patternHolder);

					const doc = new DOMParser().parseFromString(
						`<svg xmlns="${ns}">${patternDef}</svg>`,
						"image/svg+xml",
					);
					const el = doc.documentElement.firstElementChild;
					if (el) defs.appendChild(document.importNode(el, true));

					// Pre-rasterize any SVG <image> elements in the pattern to PNG data URLs.
					// This lets the browser cache a bitmap tile instead of re-rendering the
					// SVG vector on every paint, which is a major source of zoom lag.
					void rasterizePatternImages(defs);
				}
			});

		function onZoom() {
			layer?.setStyle((feature) =>
				getFeatureStyle(
					feature,
					weightAttribute
						? ((feature?.properties as Record<string, unknown>)?.[weightAttribute] as number) ?? 1
						: 1,
				),
			);
		}

		if (geoScale) m.on("zoomend", onZoom);

		return () => {
			cancelled = true;
			patternHolder?.remove();
			layer?.remove();
			m.off("zoomend", onZoom);
		};
	}, [map, src, style, geoScale, weightAttribute, colorAttribute, fillColorAttribute, patternDef, pane, useCanvas]);

	return null;
}
