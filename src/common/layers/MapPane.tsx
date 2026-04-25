import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

type Props = {
	name: string;
	zIndex: number;
	/** Hide when zoom reaches this level */
	hideAtZoom?: number;
	/** Show when zoom reaches this level */
	showAtZoom?: number;
};

export function MapPane({ name, zIndex, hideAtZoom, showAtZoom }: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;
		const pane = map.createPane(name);
		pane.style.zIndex = String(zIndex);

		if (hideAtZoom !== undefined || showAtZoom !== undefined) {
			pane.style.transition = "opacity 250ms";
			const terms: string[] = [];
			if (hideAtZoom !== undefined)
				terms.push(`${hideAtZoom} - var(--map-zoom-anim)`);
			if (showAtZoom !== undefined)
				terms.push(`var(--map-zoom-anim) - ${showAtZoom - 0.01}`);
			const inner =
				terms.length === 1 ? terms[0] : `min(${terms.join(", ")})`;
			pane.style.opacity = `clamp(0, calc((${inner}) * 9999), 1)`;
		}

		return () => {
			pane.remove();
		};
	}, [map, name, zIndex, hideAtZoom, showAtZoom]);

	return null;
}
