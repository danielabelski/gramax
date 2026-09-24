import { createParseScheduler } from "./ParseScheduler";

describe("createParseScheduler", () => {
	test("yields only after the time budget is exhausted", async () => {
		let now = 0;
		let yieldCount = 0;
		const scheduler = createParseScheduler({
			budgetMs: 8,
			enabled: true,
			now: () => now,
			yieldToMain: async () => {
				yieldCount++;
			},
		});
		const schedule = scheduler.start();

		now = 7;
		await schedule();
		expect(yieldCount).toBe(0);

		now = 8;
		await schedule();
		expect(yieldCount).toBe(1);

		now = 15;
		await schedule();
		expect(yieldCount).toBe(1);

		now = 16;
		await schedule();
		expect(yieldCount).toBe(2);
	});

	test("coalesces concurrent yields", async () => {
		let now = 0;
		let resolveYield: () => void;
		const yieldToMain = jest.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveYield = resolve;
				}),
		);
		const scheduler = createParseScheduler({
			budgetMs: 8,
			enabled: true,
			now: () => now,
			yieldToMain,
		});

		const firstSchedule = scheduler.start();
		const secondSchedule = scheduler.start();
		now = 8;
		const firstYield = firstSchedule();
		const secondYield = secondSchedule();

		expect(firstYield).toBe(secondYield);
		expect(yieldToMain).toHaveBeenCalledTimes(1);
		resolveYield();
		await firstYield;
	});

	test("starts a fresh budget after all parse operations finish", async () => {
		let now = 0;
		const yieldToMain = jest.fn(async () => undefined);
		const scheduler = createParseScheduler({
			budgetMs: 8,
			enabled: true,
			now: () => now,
			yieldToMain,
		});

		const firstSchedule = scheduler.start();
		now = 8;
		await firstSchedule();
		scheduler.finish();

		now = 100;
		const secondSchedule = scheduler.start();
		now = 107;
		await secondSchedule();

		expect(yieldToMain).toHaveBeenCalledTimes(1);
	});
});
