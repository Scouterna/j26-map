import pinRaw from "../../assets/pin_raw.svg?raw";

const MARKER_SIZE = 32;
const ICON_INSET_TOP_PCT = 42;
const ICON_CONTENT_PCT = 55;

const pinSvg = pinRaw
	.replace(/width="[^"]*"/, 'width="100%"')
	.replace(/height="[^"]*"/, 'height="100%"');

export function createMarkerElement(color: string, iconUrl?: string, size = MARKER_SIZE): HTMLElement {
	const iconOverlay = iconUrl
		? `<div style="position:absolute;top:${ICON_INSET_TOP_PCT}%;left:50%;transform:translate(-50%,-50%);width:${ICON_CONTENT_PCT}%;aspect-ratio:1;background:white;-webkit-mask-image:url('${iconUrl}');-webkit-mask-repeat:no-repeat;-webkit-mask-size:contain;-webkit-mask-position:center;mask-image:url('${iconUrl}');mask-repeat:no-repeat;mask-size:contain;mask-position:center"></div>`
		: "";

	const el = document.createElement("div");
	el.className = "j26-marker";
	// No position:relative here — MapLibre sets position:absolute via .maplibregl-marker
	el.style.cssText = `width:${size}px;height:${size}px`;
	el.innerHTML = `<div style="--pin-color:${color};width:100%;height:100%;position:relative">${pinSvg}${iconOverlay}</div>`;
	return el;
}
