import pinRaw from "../../assets/pin_raw.svg?raw";

const MARKER_SIZE = 32;
const ICON_INSET_TOP_PCT = 42;
const ICON_CONTENT_PCT = 55;

const pinSvg = pinRaw
	.replace(/width="[^"]*"/, 'width="100%"')
	.replace(/height="[^"]*"/, 'height="100%"');

export const SVG_BADGE_WIDTH = 71;

export function createSvgBadgeMarker(svgUrl: string, width = SVG_BADGE_WIDTH): HTMLElement {
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

export function createMarkerElement(color: string, size = MARKER_SIZE): HTMLElement {
	const el = document.createElement("div");
	el.className = "j26-marker";
	// No position:relative here — MapLibre sets position:absolute via .maplibregl-marker
	el.style.cssText = `width:${size}px;height:${size}px`;
	el.innerHTML = `<div class="j26-marker-pin" style="--pin-color:${color};width:100%;height:100%;position:relative">${pinSvg}</div>`;
	return el;
}

// Overlay the category icon as a white shape masked by the icon SVG. Applied
// separately (and usually async) from createMarkerElement because Tabler icons
// come from a cross-origin CDN and iOS/WebKit won't apply a cross-origin
// mask-image — callers pass a mask-safe URL from getIconMaskUrl/toMaskSafeUrl.
export function applyMarkerIcon(markerEl: HTMLElement, maskUrl: string): void {
	const pin = markerEl.querySelector<HTMLElement>(".j26-marker-pin");
	if (!pin) return;
	const overlay = document.createElement("div");
	overlay.style.cssText = `position:absolute;top:${ICON_INSET_TOP_PCT}%;left:50%;transform:translate(-50%,-50%);width:${ICON_CONTENT_PCT}%;aspect-ratio:1;background:white;-webkit-mask:url('${maskUrl}') no-repeat center/contain;mask:url('${maskUrl}') no-repeat center/contain`;
	pin.appendChild(overlay);
}
