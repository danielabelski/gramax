import { act, renderHook, waitFor } from "@testing-library/react";
import {
	addAgentSecretNameToCache,
	removeAgentSecretNameFromCache,
	renameAgentSecretNameInCache,
	useAgentSecretNames,
} from "./useAgentSecretNames";

const mockListCall = jest.fn();

jest.mock("@core-ui/hooks/useApi", () => ({
	useDeferApi: (props: { url: (api: Record<string, () => string>) => string }) => {
		const endpoint = props.url({
			getAgentSecretsListUrl: () => "list",
		});
		if (endpoint === "list") return { call: mockListCall };
		throw new Error(`useAgentSecretNames.unit.test: unexpected endpoint "${endpoint}"`);
	},
}));

/**
 * `useAgentSecretNames` caches in module-level singletons on purpose — that's what lets every open chat/skill
 * editor share one fetch. These two tests deliberately run as one continuous lifecycle of that singleton, in
 * file order (Jest runs tests within a file sequentially), rather than resetting the module between them —
 * resetting would load a second copy of `react` and break `renderHook`.
 */
describe("useAgentSecretNames", () => {
	test("dedupes the fetch, survives a failed attempt without poisoning the cache, and shares the retried result", async () => {
		// useApi's `call` swallows request errors (consumeError) and resolves to undefined instead of throwing
		mockListCall.mockResolvedValueOnce(undefined);

		const first = renderHook(() => useAgentSecretNames());
		const second = renderHook(() => useAgentSecretNames());
		await waitFor(() => expect(mockListCall).toHaveBeenCalledTimes(1));
		await act(async () => {});
		expect(first.result.current).toBeNull();
		expect(second.result.current).toBeNull();

		act(() => {
			addAgentSecretNameToCache("IGNORED");
			removeAgentSecretNameFromCache("IGNORED");
			renameAgentSecretNameInCache("IGNORED", "STILL_IGNORED");
		});
		expect(first.result.current).toBeNull();

		mockListCall.mockResolvedValueOnce({
			secrets: {
				FOO: { type: "token", token: "1" },
				BAR: { type: "token", token: "2" },
			},
		});
		const third = renderHook(() => useAgentSecretNames());
		await waitFor(() => expect(third.result.current).toEqual(["FOO", "BAR"]));

		// first/second stayed mounted through the failed attempt and pick up the later retry's result too
		expect(first.result.current).toEqual(["FOO", "BAR"]);
		expect(second.result.current).toEqual(["FOO", "BAR"]);
		expect(mockListCall).toHaveBeenCalledTimes(2);
	});

	test("reuses the warm cache for later mounts and propagates add/remove/rename to every consumer", () => {
		const before = renderHook(() => useAgentSecretNames());
		expect(before.result.current).toEqual(["FOO", "BAR"]);
		expect(mockListCall).toHaveBeenCalledTimes(2); // served from cache, no new fetch

		const other = renderHook(() => useAgentSecretNames());

		act(() => addAgentSecretNameToCache("BAZ"));
		expect(before.result.current).toEqual(["FOO", "BAR", "BAZ"]);
		expect(other.result.current).toEqual(["FOO", "BAR", "BAZ"]);

		act(() => removeAgentSecretNameFromCache("FOO"));
		expect(before.result.current).toEqual(["BAR", "BAZ"]);
		expect(other.result.current).toEqual(["BAR", "BAZ"]);

		act(() => renameAgentSecretNameInCache("BAR", "QUX"));
		expect(before.result.current).toEqual(["QUX", "BAZ"]);
		expect(other.result.current).toEqual(["QUX", "BAZ"]);
	});
});
