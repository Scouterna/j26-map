export type IconVariant = "filled" | "outline";

function sanitizeIconSegment(iconName: string) {
	return iconName.replace(/[^a-z0-9-]/gi, "");
}

export function getIconURL(iconName: string, variant: IconVariant = "outline") {
	const sanitizedIconName = sanitizeIconSegment(iconName);
	const sanitizedVariant = sanitizeIconSegment(variant);

	return `https://unpkg.com/@tabler/icons/icons/${sanitizedVariant}/${sanitizedIconName}.svg`;
}
