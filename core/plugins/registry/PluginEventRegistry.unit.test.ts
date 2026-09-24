import { PluginEventEmitter } from "./PluginEventRegistry";

describe("PluginEventEmitter", () => {
	const payload = {
		catalogName: "docs",
		currentBranch: "main",
		targetBranch: "release",
	};

	test("allows branch checkout without handlers", async () => {
		const events = new PluginEventEmitter();

		await expect(events.emit("git:branch:before-checkout", payload)).resolves.toBe(true);
	});

	test("allows branch checkout when every handler returns void or true", async () => {
		const events = new PluginEventEmitter();
		events.registerEvent("void-plugin", "git:branch:before-checkout", () => undefined);
		events.registerEvent("true-plugin", "git:branch:before-checkout", async () => true);

		await expect(events.emit("git:branch:before-checkout", payload)).resolves.toBe(true);
	});

	test("blocks branch checkout when any handler returns false", async () => {
		const events = new PluginEventEmitter();
		events.registerEvent("allow-plugin", "git:branch:before-checkout", () => true);
		events.registerEvent("block-plugin", "git:branch:before-checkout", async () => false);

		await expect(events.emit("git:branch:before-checkout", payload)).resolves.toBe(false);
	});
});
