import { useEffect } from "preact/hooks";
import { useMap } from "../MapCanvas";

type Props = {
	name: string;
	zIndex: number;
};

export function MapPane({ name, zIndex }: Props) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;
		const pane = map.createPane(name);
		pane.style.zIndex = String(zIndex);
		return () => {
			pane.remove();
		};
	}, [map, name, zIndex]);

	return null;
}
