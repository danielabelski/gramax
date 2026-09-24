export const createSequentialPoller = (intervalMs: number, callback: () => Promise<void>): (() => void) => {
	let stopped = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const scheduleNext = () => {
		if (stopped) return;

		timeoutId = setTimeout(async () => {
			if (stopped) return;

			try {
				await callback();
			} finally {
				scheduleNext();
			}
		}, intervalMs);
	};

	scheduleNext();

	return () => {
		stopped = true;
		if (timeoutId !== null) clearTimeout(timeoutId);
	};
};
