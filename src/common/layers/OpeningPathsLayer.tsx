import type maplibregl from "maplibre-gl";
import type {
	ExpressionSpecification,
	LineLayerSpecification,
	SymbolLayerSpecification,
} from "maplibre-gl";
import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";
import { layerUrl } from "../mapLayers";

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

// blue-700, the same navy as the map's label chips. Every district fill is a
// mid-to-light saturated color (orange, pink, blue, crimson, greens), so the
// darkest brand color is the one that holds up against all of them — an amber
// or mid-tone path disappears over the orange district. The white casing does
// the rest of the work over dark fills like the Amazonas forest green.
const PATH_COLOR = "#003660";
const CASING_COLOR = "#ffffff";
// The chevrons sit on top of the path, so they are white with a near-black navy
// outline — a navy-on-navy arrow would disappear.
const ARROW_COLOR = "#ffffff";
const ARROW_OUTLINE_COLOR = "#00162d";

// The arrow glyph is rasterized once. The canvas is ARROW_SIZE *
// ARROW_PIXEL_RATIO px while the logical icon stays ARROW_SIZE px, so a high
// ratio just buys resolution — needed because icon-size scales the arrows well
// past their logical size at high zoom.
const ARROW_PIXEL_RATIO = 16;
const ARROW_SIZE = 16;
const ARROW_IMAGE_ID = "opening-path-arrow";

type PathKind = {
	/** Layer/source id prefix and the geojson layer name (they match). */
	name: string;
	/** Stroke width of the path itself at zoom 14 / 19. */
	width: [number, number];
	/** White casing drawn under the path, added on top of `width`. */
	casing: number;
	/** Arrow icon-size at zoom 14 / 19. */
	arrowSize: [number, number];
	/** Distance between arrows in px at zoom 14 / 19. */
	arrowSpacing: [number, number];
	/**
	 * Pin an extra arrow to the last vertex of every line. Line-placed symbols are
	 * spaced from the middle outwards, so a short path can end up with no arrow
	 * anywhere near where it actually leads.
	 */
	endArrow?: boolean;
};

const KINDS: PathKind[] = [
	{
		name: "opening_sub_paths",
		width: [1.5, 5],
		casing: 3,
		arrowSize: [0.75, 2.1],
		arrowSpacing: [70, 160],
		endArrow: true,
	},
	{
		name: "opening_main_paths",
		width: [3, 11],
		casing: 4,
		arrowSize: [1.2, 3.3],
		arrowSpacing: [100, 240],
	},
];

type Position = [number, number];

/** Compass bearing (clockwise from north) of the a→b segment. */
function bearing(a: Position, b: Position): number {
	// Equirectangular is plenty at this scale, and it keeps the icon rotation
	// consistent with how MapLibre renders the (Web Mercator) line beneath it.
	const dx = (b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
	const dy = b[1] - a[1];
	return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * One Point per line, at its last vertex, carrying the icon rotation needed to
 * line the arrow up with the final segment. `icon-rotate` is clockwise from
 * north while the arrow image points east, hence the -90.
 */
function endpointFeatures(data: GeoJSON.GeoJSON): GeoJSON.FeatureCollection {
	const features: GeoJSON.Feature[] = [];

	const addLine = (coords: Position[]) => {
		if (coords.length < 2) return;
		const end = coords[coords.length - 1];
		const prev = coords[coords.length - 2];
		features.push({
			type: "Feature",
			properties: { rotate: bearing(prev, end) - 90 },
			geometry: { type: "Point", coordinates: end },
		});
	};

	const collection = data.type === "FeatureCollection" ? data.features : [];
	for (const feature of collection) {
		const geometry = feature.geometry;
		if (geometry.type === "LineString") {
			addLine(geometry.coordinates as Position[]);
		} else if (geometry.type === "MultiLineString") {
			for (const line of geometry.coordinates) addLine(line as Position[]);
		}
	}

	return { type: "FeatureCollection", features };
}

/**
 * A chevron pointing along +x. MapLibre rotates line-placed icons so that the
 * image's +x axis follows the line direction, i.e. the winding order of the
 * geojson coordinates decides which way the arrows point.
 */
function makeArrowImage(): ImageData {
	const s = ARROW_SIZE * ARROW_PIXEL_RATIO;
	const canvas = document.createElement("canvas");
	canvas.width = s;
	canvas.height = s;
	// biome-ignore lint/style/noNonNullAssertion: 2d context is always available.
	const ctx = canvas.getContext("2d")!;

	const chevron = () => {
		ctx.beginPath();
		ctx.moveTo(s * 0.28, s * 0.18);
		ctx.lineTo(s * 0.75, s * 0.5);
		ctx.lineTo(s * 0.28, s * 0.82);
	};

	ctx.lineJoin = "round";
	ctx.lineCap = "round";

	// Outline first, so it shows as a thin edge around the white chevron.
	ctx.strokeStyle = ARROW_OUTLINE_COLOR;
	ctx.lineWidth = s * 0.3;
	chevron();
	ctx.stroke();

	ctx.strokeStyle = ARROW_COLOR;
	ctx.lineWidth = s * 0.16;
	chevron();
	ctx.stroke();

	return ctx.getImageData(0, 0, s, s);
}

export function OpeningPathsLayer() {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		const addedImages: string[] = [];
		const addedLayers: string[] = [];
		const addedSources: string[] = [];

		// Sub paths first so main paths draw on top of them.
		for (const kind of KINDS) {
			const srcId = `${kind.name}-src`;
			const casingId = `${kind.name}-casing`;
			const lineId = `${kind.name}-line`;
			const arrowId = `${kind.name}-arrows`;
			const endSrcId = `${kind.name}-ends-src`;
			const endArrowId = `${kind.name}-end-arrows`;

			map.addSource(srcId, { type: "geojson", data: EMPTY_FC });
			addedSources.push(srcId);

			// Both kinds share one glyph; only the first pass registers it.
			if (!map.hasImage(ARROW_IMAGE_ID)) {
				map.addImage(ARROW_IMAGE_ID, makeArrowImage(), {
					pixelRatio: ARROW_PIXEL_RATIO,
				});
				addedImages.push(ARROW_IMAGE_ID);
			}

			const zoomWidth = (extra: number): LineLayerSpecification["paint"] => ({
				"line-color": extra ? CASING_COLOR : PATH_COLOR,
				"line-width": [
					"interpolate",
					["linear"],
					["zoom"],
					14,
					kind.width[0] + extra,
					19,
					kind.width[1] + extra,
				],
			});

			for (const [id, extra] of [
				[casingId, kind.casing],
				[lineId, 0],
			] as const) {
				const spec: LineLayerSpecification = {
					id,
					type: "line",
					source: srcId,
					paint: zoomWidth(extra),
					layout: { "line-cap": "round", "line-join": "round" },
				};
				map.addLayer(spec);
				addedLayers.push(id);
			}

			const iconSize: ExpressionSpecification = [
				"interpolate",
				["linear"],
				["zoom"],
				14,
				kind.arrowSize[0],
				19,
				kind.arrowSize[1],
			];

			const arrowSpec: SymbolLayerSpecification = {
				id: arrowId,
				type: "symbol",
				source: srcId,
				layout: {
					"symbol-placement": "line",
					"icon-image": ARROW_IMAGE_ID,
					"icon-rotation-alignment": "map",
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
					"icon-size": iconSize,
					"symbol-spacing": [
						"interpolate",
						["linear"],
						["zoom"],
						14,
						kind.arrowSpacing[0],
						19,
						kind.arrowSpacing[1],
					],
				},
			};
			map.addLayer(arrowSpec);
			addedLayers.push(arrowId);

			if (kind.endArrow) {
				map.addSource(endSrcId, { type: "geojson", data: EMPTY_FC });
				addedSources.push(endSrcId);

				const endSpec: SymbolLayerSpecification = {
					id: endArrowId,
					type: "symbol",
					source: endSrcId,
					layout: {
						"icon-image": ARROW_IMAGE_ID,
						"icon-rotation-alignment": "map",
						"icon-rotate": ["get", "rotate"],
						// Anchor the image's right edge on the last vertex so the arrow
						// sits just inside the line end instead of overshooting it.
						"icon-anchor": "right",
						"icon-allow-overlap": true,
						"icon-ignore-placement": true,
						"icon-size": iconSize,
					},
				};
				map.addLayer(endSpec);
				addedLayers.push(endArrowId);
			}

			fetch(layerUrl(kind.name))
				.then((r) => r.json())
				.then((data) => {
					const source = map.getSource(srcId) as
						| maplibregl.GeoJSONSource
						| undefined;
					source?.setData(data);

					if (!kind.endArrow) return;
					const endSource = map.getSource(endSrcId) as
						| maplibregl.GeoJSONSource
						| undefined;
					endSource?.setData(endpointFeatures(data));
				});
		}

		return () => {
			for (const id of addedLayers) {
				if (map.getLayer(id)) map.removeLayer(id);
			}
			for (const id of addedSources) {
				if (map.getSource(id)) map.removeSource(id);
			}
			for (const id of addedImages) {
				if (map.hasImage(id)) map.removeImage(id);
			}
		};
	}, [map]);

	return null;
}
