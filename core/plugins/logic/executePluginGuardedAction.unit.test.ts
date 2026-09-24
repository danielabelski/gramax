import { executePluginGuardedAction } from "./executePluginGuardedAction";

describe("executePluginGuardedAction", () => {
	const payload = {
		catalogName: "docs",
		currentBranch: "main",
		targetBranch: "release",
	};

	test("runs the action when plugins allow it", async () => {
		const action = jest.fn().mockResolvedValue("done");
		const emit = jest.fn().mockResolvedValue(true);
		const waitForReady = jest.fn().mockResolvedValue(undefined);

		await expect(
			executePluginGuardedAction("git:branch:before-checkout", payload, action, emit, waitForReady),
		).resolves.toEqual({
			allowed: true,
			result: "done",
		});
		expect(waitForReady).toHaveBeenCalledTimes(1);
		expect(waitForReady.mock.invocationCallOrder[0]).toBeLessThan(emit.mock.invocationCallOrder[0]);
		expect(action).toHaveBeenCalledTimes(1);
	});

	test("does not run the action when a plugin blocks it", async () => {
		const action = jest.fn();
		const emit = jest.fn().mockResolvedValue(false);
		const waitForReady = jest.fn().mockResolvedValue(undefined);

		await expect(
			executePluginGuardedAction("git:branch:before-checkout", payload, action, emit, waitForReady),
		).resolves.toEqual({ allowed: false, reason: "veto" });
		expect(action).not.toHaveBeenCalled();
	});

	test("fails closed when an event handler fails", async () => {
		const action = jest.fn();
		const emit = jest.fn().mockRejectedValue(new Error("plugin failed"));
		const waitForReady = jest.fn().mockResolvedValue(undefined);

		await expect(
			executePluginGuardedAction("git:branch:before-checkout", payload, action, emit, waitForReady),
		).resolves.toEqual({ allowed: false, reason: "error", error: expect.any(Error) });
		expect(action).not.toHaveBeenCalled();
	});

	test("fails closed when plugins do not become ready", async () => {
		const action = jest.fn();
		const emit = jest.fn();
		const waitForReady = jest.fn().mockRejectedValue(new Error("plugins unavailable"));

		await expect(
			executePluginGuardedAction("git:branch:before-checkout", payload, action, emit, waitForReady),
		).resolves.toEqual({ allowed: false, reason: "error", error: expect.any(Error) });
		expect(emit).not.toHaveBeenCalled();
		expect(action).not.toHaveBeenCalled();
	});
});
