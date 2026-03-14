import { DivIcon } from "leaflet";
import PinSvg from "./pin.svg?raw";

export function createMarkerIcon(color: string, iconSvg = "") {
	return new DivIcon({
		className: `j26-marker j26-marker--${color}`,
		html: `
			<div class="j26-marker__container">
				${PinSvg}
				<div class="j26-marker__icon">${iconSvg}</div>
			</div>
		`,
		iconSize: [40, 40],
		iconAnchor: [20, 40],
	});
}
