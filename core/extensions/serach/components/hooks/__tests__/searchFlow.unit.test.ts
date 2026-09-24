import { useSearchQuery } from "@ext/serach/components/hooks/useSearchQuery";
import { useSearchRequest } from "@ext/serach/components/hooks/useSearchRequest";
import type { SearchParams } from "@ext/serach/components/model/searchParams";
import { act, renderHook } from "@testing-library/react";
import { createFakeGateway, makeArticleResult, makeParams, makeRows } from "../../model/__tests__/fixtures";

const DELAY = 400;
const rows = makeRows([makeArticleResult("docs/a.md")]);

/** The query debounce wired to the request exactly as useSearchState wires them. */
const useSearchFlow = (props: {
	query: string;
	params: SearchParams;
	gateway: ReturnType<typeof createFakeGateway>;
}) => {
	const search = useSearchQuery({
		query: props.query,
		delayMs: DELAY,
		flushOn: props.params,
	});

	return useSearchRequest({
		gateway: props.gateway,
		params: props.params,
		query: search.settled,
		enabled: true,
	});
};

const render = () => {
	const gateway = createFakeGateway();
	gateway.search.mockResolvedValue(rows);
	const params = makeParams();

	const result = renderHook(
		(props: { query: string; params: SearchParams }) => useSearchFlow({ ...props, gateway }),
		{
			initialProps: { query: "q1", params },
		},
	);

	return { ...result, gateway, params };
};

const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms));
const settle = () => act(async () => {});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("query debounce wired to the request", () => {
	it("searches the initial query without waiting out the debounce", async () => {
		const { gateway } = render();

		await settle();

		expect(gateway.search).toHaveBeenCalledTimes(1);
		expect(gateway.search).toHaveBeenCalledWith(expect.anything(), "q1", expect.any(AbortSignal));

		advance(DELAY);
		await settle();

		expect(gateway.search).toHaveBeenCalledTimes(1);
	});

	it("searches again when the query returns to its settled value mid-debounce", async () => {
		const { result, rerender, gateway, params } = render();
		await settle();
		expect(gateway.search).toHaveBeenCalledTimes(1);

		rerender({ query: "q2", params });
		advance(DELAY / 2);
		rerender({ query: "q1", params });
		advance(DELAY);
		await settle();

		expect(gateway.search).toHaveBeenCalledTimes(2);
		expect(gateway.search).toHaveBeenLastCalledWith(expect.anything(), "q1", expect.any(AbortSignal));
		expect(result.current.data).toEqual({ kind: "search", rows });
	});

	it("keeps the visible results while a new query is still being typed", async () => {
		const { result, rerender, gateway, params } = render();
		await settle();

		rerender({ query: "q2", params });
		advance(DELAY / 2);

		expect(result.current.data).toEqual({ kind: "search", rows });
		expect(gateway.search).toHaveBeenCalledTimes(1);
	});

	it("searches the typed query at once when the params change mid-debounce", async () => {
		const { rerender, gateway } = render();
		await settle();

		rerender({ query: "q2", params: makeParams() });
		rerender({ query: "q2", params: makeParams({ catalogName: "other" }) });
		await settle();

		expect(gateway.search).toHaveBeenCalledTimes(3);
		expect(gateway.search).toHaveBeenLastCalledWith(
			expect.objectContaining({ catalogName: "other" }),
			"q2",
			expect.any(AbortSignal),
		);
	});
});
