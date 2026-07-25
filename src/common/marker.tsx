import pinRaw from "../../assets/pin_raw.svg?raw";

const MARKER_SIZE = 32;
const ICON_INSET_TOP_PCT = 42;
const ICON_CONTENT_PCT = 55;

const pinSvg = pinRaw
	.replace(/width="[^"]*"/, 'width="100%"')
	.replace(/height="[^"]*"/, 'height="100%"');

export const SVG_BADGE_WIDTH = 71;

export function createSvgBadgeMarker(
	svgUrl: string,
	width = SVG_BADGE_WIDTH,
): HTMLElement {
	const el = document.createElement("div");
	el.className = "j26-marker j26-badge-scale";
	el.style.cssText = `width:${width}px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))`;
	const img = document.createElement("img");
	img.src = svgUrl;
	img.alt = "";
	img.style.cssText = "width:100%;height:auto;display:block";
	el.appendChild(img);
	return el;
}

export function createMarkerElement(
	color: string,
	size = MARKER_SIZE,
): HTMLElement {
	const el = document.createElement("div");
	el.className = "j26-marker";
	// No position:relative here — MapLibre sets position:absolute via .maplibregl-marker
	// when this element is used as the marker element (preview/picker). In the map,
	// it's a child of the marker element and .j26-dotify makes it the dot's containing
	// block instead (see style.css).
	// --pin-color lives on the container so both the pin and the declutter dot inherit it.
	el.style.cssText = `width:${size}px;height:${size}px;--pin-color:${color}`;
	// The dot (a sibling of the pin) is shown instead of the pin when the marker
	// is decluttered — see the .j26-dotted rules in style.css.
	el.innerHTML = `<div class="j26-marker-pin" style="width:100%;height:100%;position:relative">${pinSvg}</div><div class="j26-marker-dot" aria-hidden="true"></div>`;
	return el;
}

// Overlay the category icon as a white shape masked by the icon SVG. Applied
// separately (and async) from createMarkerElement — callers pass a mask-safe URL
// from getIconMaskUrl/toMaskSafeUrl (icons are same-origin, so this resolves
// without a network round-trip).
export function applyMarkerIcon(markerEl: HTMLElement, maskUrl: string): void {
	const pin = markerEl.querySelector<HTMLElement>(".j26-marker-pin");
	if (!pin) return;
	const overlay = document.createElement("div");
	overlay.style.cssText = `position:absolute;top:${ICON_INSET_TOP_PCT}%;left:50%;transform:translate(-50%,-50%);width:${ICON_CONTENT_PCT}%;aspect-ratio:1;background:white;-webkit-mask:url('${maskUrl}') no-repeat center/contain;mask:url('${maskUrl}') no-repeat center/contain`;
	pin.appendChild(overlay);
}
