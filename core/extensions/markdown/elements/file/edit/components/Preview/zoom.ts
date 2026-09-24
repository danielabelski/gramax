export const ZOOM_LEVELS: readonly number[] = [
	0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
];

export const getNextZoom = (currentZoom: number, direction: -1 | 1): number => {
	const currentIndex = ZOOM_LEVELS.indexOf(currentZoom);
	const nextIndex = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, currentIndex + direction));

	return ZOOM_LEVELS[nextIndex];
};
