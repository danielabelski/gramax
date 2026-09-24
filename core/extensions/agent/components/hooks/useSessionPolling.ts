import { useCallback, useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 450;

export const useSessionPolling = (intervalMs: number = DEFAULT_INTERVAL_MS) => {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const stoppedRef = useRef(true);

	const stop = useCallback(() => {
		stoppedRef.current = true;
		if (timerRef.current != null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const start = useCallback(
		(tick: () => Promise<void> | void) => {
			stop();
			stoppedRef.current = false;

			const scheduleNext = () => {
				if (stoppedRef.current) return;
				timerRef.current = setTimeout(() => {
					timerRef.current = null;
					void runTick();
				}, intervalMs);
			};

			const runTick = async () => {
				if (stoppedRef.current) return;
				try {
					await tick();
				} catch {
				} finally {
					scheduleNext();
				}
			};

			void runTick();
		},
		[intervalMs, stop],
	);

	useEffect(() => stop, [stop]);

	return { start, stop };
};
