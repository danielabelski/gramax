export type ParseSchedule = () => Promise<void> | undefined;

export type ParseScheduler = {
	start: () => ParseSchedule;
	finish: () => void;
};

type SchedulerApi = {
	yield?: () => Promise<void>;
};

type ParseSchedulerOptions = {
	budgetMs?: number;
	enabled?: boolean;
	now?: () => number;
	yieldToMain?: () => Promise<void>;
};

const yieldToMain = () => {
	const scheduler = (globalThis as typeof globalThis & { scheduler?: SchedulerApi }).scheduler;
	if (scheduler?.yield) return scheduler.yield();
	return new Promise<void>((resolve) => setTimeout(resolve, 0));
};

export const createParseScheduler = ({
	budgetMs = 8,
	enabled = typeof window !== "undefined",
	now = () => performance.now(),
	yieldToMain: scheduleYield = yieldToMain,
}: ParseSchedulerOptions = {}): ParseScheduler => {
	let lastYield = now();
	let pendingYield: Promise<void> | undefined;
	let activeOperations = 0;

	const schedule: ParseSchedule = () => {
		if (!enabled) return;
		if (pendingYield) return pendingYield;
		if (now() - lastYield < budgetMs) return;

		pendingYield = scheduleYield()
			.then(() => {
				lastYield = now();
			})
			.finally(() => {
				pendingYield = undefined;
			});
		return pendingYield;
	};

	return {
		start: () => {
			if (activeOperations === 0) lastYield = now();
			activeOperations++;
			return schedule;
		},
		finish: () => {
			activeOperations = Math.max(0, activeOperations - 1);
		},
	};
};
