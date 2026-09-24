import { type UseSearchRequestArgs, useSearchRequest } from "@ext/serach/components/hooks/useSearchRequest";
import { SearchRequestError } from "@ext/serach/components/model/searchRequestError";
import type { RowSearchResult } from "@ext/serach/utils/SearchRowsModel";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
	createFakeGateway,
	deferred,
	type FakeGateway,
	makeArticleResult,
	makeParams,
	makeRows,
} from "../../model/__tests__/fixtures";

const rows = makeRows([makeArticleResult("docs/a.md")]);

const gatewayReturning = (rows: RowSearchResult[]) => {
	const gateway = createFakeGateway();
	gateway.search.mockResolvedValue(rows);
	return gateway;
};

const render = (overrides: Partial<UseSearchRequestArgs> = {}) => {
	const gateway = (overrides.gateway as FakeGateway) ?? createFakeGateway();
	const onResults = jest.fn();
	const onError = jest.fn();

	const initialProps: UseSearchRequestArgs = {
		gateway,
		params: makeParams(),
		query: { value: "q", revision: 0 },
		enabled: true,
		onResults,
		onError,
		...overrides,
	};

	const result = renderHook((args: UseSearchRequestArgs) => useSearchRequest(args), { initialProps });
	return { ...result, gateway, onResults, onError, initialProps };
};

describe("useSearchRequest", () => {
	describe("running", () => {
		it("searches and exposes the rows", async () => {
			const { result, onResults } = render({ gateway: gatewayReturning(rows) });

			await waitFor(() => expect(result.current.data).toEqual({ kind: "search", rows }));
			expect(onResults).toHaveBeenCalledWith("q", rows);
		});

		it("passes the params and query straight to the gateway", async () => {
			const params = makeParams({ catalogName: "docs" });
			const { gateway } = render({ params });

			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));
			expect(gateway.search).toHaveBeenCalledWith(params, "q", expect.any(AbortSignal));
		});

		it("does not run while the dialog is closed", () => {
			const { gateway } = render({ enabled: false });

			expect(gateway.search).not.toHaveBeenCalled();
		});

		it("does not run a blank query with no property filter", () => {
			const { gateway } = render({ query: { value: "", revision: 0 } });

			expect(gateway.search).not.toHaveBeenCalled();
		});

		it("runs a blank query once a property filter is set", () => {
			const params = makeParams({ propertyFilter: { op: "isEmpty", key: "status" } });
			const { gateway } = render({ query: { value: "", revision: 0 }, params });

			expect(gateway.search).toHaveBeenCalledTimes(1);
		});

		it("keeps no rows when the response is dropped", async () => {
			const gateway = createFakeGateway();
			gateway.search.mockResolvedValue(undefined);
			const { result, onResults } = render({ gateway });

			await waitFor(() => expect(gateway.search).toHaveBeenCalled());
			expect(result.current.data).toBeNull();
			expect(onResults).not.toHaveBeenCalled();
		});
	});

	describe("input changes", () => {
		it("clears the previous rows and aborts the in-flight call on a new query", async () => {
			const gateway = gatewayReturning(rows);
			const { result, rerender, initialProps } = render({ gateway });
			await waitFor(() => expect(result.current.data).not.toBeNull());
			const firstSignal = gateway.lastSignal();

			rerender({ ...initialProps, query: { value: "other", revision: 1 } });

			expect(result.current.data).toBeNull();
			expect(firstSignal.aborted).toBe(true);
			expect(gateway.search).toHaveBeenCalledTimes(2);
		});

		it("re-runs when the same query settles again", async () => {
			const { rerender, gateway, initialProps } = render();
			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, query: { value: "q", revision: 1 } });

			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(2));
		});

		it("re-runs when the params change", async () => {
			const { rerender, gateway, initialProps } = render();
			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, params: makeParams({ catalogName: "other" }) });

			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(2));
		});

		it("does not re-run when nothing it depends on changed", async () => {
			const { rerender, gateway, initialProps } = render();
			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, onResults: jest.fn(), onError: jest.fn() });

			expect(gateway.search).toHaveBeenCalledTimes(1);
		});

		it("aborts but keeps the results when the dialog closes", async () => {
			const gateway = gatewayReturning(rows);
			const { result, rerender, initialProps } = render({ gateway });
			await waitFor(() => expect(result.current.data).not.toBeNull());

			rerender({ ...initialProps, enabled: false });

			expect(result.current.data).toEqual({ kind: "search", rows });
			expect(gateway.lastSignal().aborted).toBe(true);
		});

		it("does not repeat a search that already answered when the dialog reopens", async () => {
			const gateway = gatewayReturning(rows);
			const { result, rerender, initialProps } = render({ gateway });
			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, enabled: false });
			rerender({ ...initialProps, enabled: true });

			expect(gateway.search).toHaveBeenCalledTimes(1);
			expect(result.current.data).toEqual({ kind: "search", rows });
		});

		it("retries a search that was aborted before it answered", async () => {
			const gateway = createFakeGateway();
			const pending = deferred<RowSearchResult[]>();
			gateway.search.mockReturnValueOnce(pending.promise);
			const { rerender, initialProps } = render({ gateway });
			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, enabled: false });
			rerender({ ...initialProps, enabled: true });

			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(2));
		});

		it("aborts on unmount", async () => {
			const { unmount, gateway } = render();
			await waitFor(() => expect(gateway.search).toHaveBeenCalled());

			unmount();

			expect(gateway.lastSignal().aborted).toBe(true);
		});
	});

	describe("reload", () => {
		it("runs the same search again", async () => {
			const { result, gateway } = render();
			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));

			act(() => result.current.reload());

			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(2));
		});
	});

	describe("chat", () => {
		it("renders each streamed chunk against the accumulated buffer", async () => {
			const { result, gateway } = render({ params: makeParams({ aiEnabled: true }) });
			await waitFor(() => expect(gateway.chat).toHaveBeenCalledTimes(1));

			await act(() => gateway.emitChatChunk("hello "));
			const afterFirst = result.current.data;
			await act(() => gateway.emitChatChunk("world"));

			expect(afterFirst).toEqual({ kind: "chat", nodes: expect.anything() });
			expect(result.current.data).not.toBe(afterFirst);
			expect(gateway.search).not.toHaveBeenCalled();
		});

		it("fails a stream that ended without any text", async () => {
			const { result, gateway } = render({ params: makeParams({ aiEnabled: true }) });
			await waitFor(() => expect(gateway.chat).toHaveBeenCalledTimes(1));

			await act(async () => gateway.endChatStream());

			await waitFor(() => expect(result.current.error).not.toBeNull());
			expect(result.current.data).toBeNull();
		});

		it("keeps a stream that produced text", async () => {
			const { result, gateway } = render({ params: makeParams({ aiEnabled: true }) });
			await waitFor(() => expect(gateway.chat).toHaveBeenCalledTimes(1));

			await act(() => gateway.emitChatChunk("answer"));
			await act(async () => gateway.endChatStream());

			await waitFor(() => expect(result.current.data).toEqual({ kind: "chat", nodes: expect.anything() }));
			expect(result.current.error).toBeNull();
		});

		it("drops a chunk that lands after the request was aborted", async () => {
			const { result, rerender, gateway, initialProps } = render({
				params: makeParams({ aiEnabled: true }),
			});
			await waitFor(() => expect(gateway.chat).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, params: makeParams({ aiEnabled: true }), enabled: false });
			await act(() => gateway.emitChatChunk("late"));

			expect(result.current.data).toBeNull();
		});
	});

	describe("errors", () => {
		it("ignores an aborted call", async () => {
			const gateway = createFakeGateway();
			const pending = deferred<never>();
			gateway.search.mockReturnValue(pending.promise);
			const { onError } = render({ gateway });

			await waitFor(() => expect(gateway.search).toHaveBeenCalled());
			await act(async () => {
				pending.reject(new DOMException("aborted", "AbortError"));
				await pending.promise.catch(() => {});
			});

			expect(onError).not.toHaveBeenCalled();
		});

		it("reports a real failure once and exposes it", async () => {
			const failure = new Error("boom");
			const gateway = createFakeGateway();
			gateway.search.mockRejectedValue(failure);
			const { result, onError } = render({ gateway });

			await waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
			expect(onError).toHaveBeenCalledTimes(1);
			expect(result.current.error).toBe(failure);
		});

		it("does not retry a failed search when the dialog reopens", async () => {
			const gateway = createFakeGateway();
			gateway.search.mockRejectedValue(new Error("boom"));
			const { rerender, initialProps } = render({ gateway });
			await waitFor(() => expect(gateway.search).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, enabled: false });
			rerender({ ...initialProps, enabled: true });

			expect(gateway.search).toHaveBeenCalledTimes(1);
		});

		it("exposes a failed request instead of waiting forever", async () => {
			const failure = new SearchRequestError(500);
			const gateway = createFakeGateway();
			gateway.search.mockRejectedValue(failure);
			const { result, onError } = render({ gateway });

			await waitFor(() => expect(result.current.error).toBe(failure));
			expect(result.current.data).toBeNull();
			expect(onError).not.toHaveBeenCalled();
		});

		it("exposes a failed chat request", async () => {
			const failure = new SearchRequestError(500);
			const gateway = createFakeGateway();
			gateway.chat.mockRejectedValue(failure);
			const { result } = render({ gateway, params: makeParams({ aiEnabled: true }) });

			await waitFor(() => expect(result.current.error).toBe(failure));
		});

		it("clears the failure once the search changes", async () => {
			const gateway = createFakeGateway();
			gateway.search.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(rows);
			const { result, rerender, initialProps } = render({ gateway });
			await waitFor(() => expect(result.current.error).not.toBeNull());

			rerender({ ...initialProps, query: { value: "other", revision: 1 } });

			expect(result.current.error).toBeNull();
			await waitFor(() => expect(result.current.data).toEqual({ kind: "search", rows }));
		});
	});
});
