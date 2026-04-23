import { DivIcon } from "leaflet";
import pinRaw from "../../assets/pin_raw.svg?raw";

const MARKER_SIZE = 32;
const ICON_INSET_TOP_PCT = 42;
const ICON_CONTENT_PCT = 55;

const pinSvg = pinRaw
	.replace(/width="[^"]*"/, 'width="100%"')
	.replace(/height="[^"]*"/, 'height="100%"');

export function createMarkerIcon(color: string, iconUrl?: string) {
	const iconOverlay = iconUrl
		? `<div style="position:absolute;top:${ICON_INSET_TOP_PCT}%;left:50%;transform:translate(-50%,-50%);width:${ICON_CONTENT_PCT}%;aspect-ratio:1;background:white;mask-image:url('${iconUrl}');mask-repeat:no-repeat;mask-size:contain;mask-position:center"></div>`
		: "";

	return new DivIcon({
		className: "j26-marker",
		html: `<div style="--pin-color:${color};width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;position:relative">${pinSvg}${iconOverlay}</div>`,
		iconSize: [MARKER_SIZE, MARKER_SIZE],
		iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE],
	});
}
