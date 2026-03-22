import { DivIcon } from "leaflet";
import { renderToStaticMarkup } from "preact-render-to-string";

export function createMarkerIcon(color: string, iconUrl?: string) {
	const html = renderToStaticMarkup(
		<div
			className="size-9 rounded-full border-[3px] border-white shadow-md relative"
			style={{ backgroundColor: color }}
		>
			{iconUrl && (
				<div
					className="absolute inset-0 p-1.5 bg-white mask-no-repeat mask-contain mask-center mask-origin-content"
					style={{ maskImage: `url('${iconUrl}')` }}
				/>
			)}
		</div>,
	);

	return new DivIcon({
		className: "j26-marker",
		html,
		iconSize: [36, 36],
		iconAnchor: [18, 18],
	});
}
