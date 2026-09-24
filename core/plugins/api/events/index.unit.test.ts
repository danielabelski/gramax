import { PluginStore } from "@plugins/store/PluginStore";
import { PLUGINS_READY_TIMEOUT_MS, waitForPluginsReady } from ".";

describe("waitForPluginsReady", () => {
	const initialState = PluginStore.getState();

	afterEach(() => {
		jest.useRealTimers();
		PluginStore.setState(initialState, true);
	});

	test("waits for an in-progress plugin load", async () => {
		PluginStore.setState({ pluginsReady: false, isLoading: true });
		const ready = waitForPluginsReady();
		let settled = false;
		void ready.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);

		await Promise.resolve();
		expect(settled).toBe(false);

		PluginStore.setState({ pluginsReady: true, isLoading: false });
		await expect(ready).resolves.toBeUndefined();
	});

	test("waits before plugin loading starts", async () => {
		PluginStore.setState({ pluginsReady: false, isLoading: false });
		const ready = waitForPluginsReady();

		PluginStore.setState({ isLoading: true });
		PluginStore.setState({ pluginsReady: true, isLoading: false });

		await expect(ready).resolves.toBeUndefined();
	});

	test("rejects when loading finishes without ready plugins", async () => {
		PluginStore.setState({ pluginsReady: false, isLoading: true });
		const ready = waitForPluginsReady();

		PluginStore.setState({ pluginsReady: false, isLoading: false });
		await expect(ready).rejects.toThrow("Plugins failed to load");
	});

	test("rejects when plugin loading never finishes", async () => {
		jest.useFakeTimers();
		PluginStore.setState({ pluginsReady: false, isLoading: true });
		const ready = waitForPluginsReady();
		const result = expect(ready).rejects.toThrow("Plugins load timeout");

		await jest.advanceTimersByTimeAsync(PLUGINS_READY_TIMEOUT_MS);

		await result;
	});
});
