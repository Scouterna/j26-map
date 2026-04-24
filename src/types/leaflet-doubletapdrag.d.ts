export {};

declare module "leaflet-doubletapdrag" {}

declare module "leaflet" {
	interface MapOptions {
		doubleTapDragZoom?: boolean | "center";
		doubleTapDragZoomOptions?: {
			reverse?: boolean;
		};
	}
}
