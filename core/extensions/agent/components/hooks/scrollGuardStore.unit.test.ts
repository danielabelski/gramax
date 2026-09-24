/**
 * @jest-environment node
 */
import { createScrollGuardStore } from "./scrollGuardStore";

describe("createScrollGuardStore", () => {
	test("tracks open guards independently and releases them one at a time", () => {
		const store = createScrollGuardStore();

		expect(store.hasOpenGuard()).toBe(false);

		const releaseFirst = store.registerOpenGuard();
		const releaseSecond = store.registerOpenGuard();

		expect(store.hasOpenGuard()).toBe(true);

		releaseFirst();
		expect(store.hasOpenGuard()).toBe(true);

		releaseSecond();
		expect(store.hasOpenGuard()).toBe(false);
	});

	test("ignores duplicate release calls", () => {
		const store = createScrollGuardStore();
		const release = store.registerOpenGuard();

		release();
		release();

		expect(store.hasOpenGuard()).toBe(false);
	});
});
