import { type UseSearchQueryArgs, useSearchQuery } from "@ext/serach/components/hooks/useSearchQuery";
import { act, renderHook } from "@testing-library/react";

const DELAY = 400;

const render = (overrides: Partial<UseSearchQueryArgs> = {}) => {
	const initialProps: UseSearchQueryArgs = {
		query: "",
		delayMs: DELAY,
		flushOn: "params",
		...overrides,
	};

	const result = renderHook((args: UseSearchQueryArgs) => useSearchQuery(args), { initialProps });

	const type = (query: string, props: Partial<UseSearchQueryArgs> = {}) =>
		result.rerender({ ...initialProps, query, ...props });

	return { ...result, initialProps, type };
};

const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useSearchQuery", () => {
	it("starts already settled on the initial query and does not settle again", () => {
		const { result } = render({ query: "abc" });

		expect(result.current.settled).toEqual({ value: "abc", revision: 0 });

		advance(DELAY);

		expect(result.current.settled).toEqual({ value: "abc", revision: 0 });
	});

	describe("debounce", () => {
		it("holds the new query until the delay passes", () => {
			const { result, type } = render();

			type("hello");
			advance(DELAY - 1);
			expect(result.current.settled.value).toBe("");
			expect(result.current.delaying).toBe(true);

			advance(1);
			expect(result.current.settled.value).toBe("hello");
			expect(result.current.delaying).toBe(false);
		});

		it("stays delaying while the query bounces back to its settled value", () => {
			const { result, type } = render({ query: "one" });

			type("two");
			advance(100);
			type("one");

			expect(result.current.delaying).toBe(true);
		});

		it("collapses rapid typing into the last query", () => {
			const { result, type } = render();

			type("h");
			advance(100);
			type("he");
			advance(100);
			type("hel");
			advance(DELAY);

			expect(result.current.settled.value).toBe("hel");
		});

		it("settles again when the query comes back to where it started", () => {
			const { result, type } = render({ query: "one" });
			const before = result.current.settled.revision;

			type("two");
			advance(100);
			type("one");
			advance(DELAY);

			expect(result.current.settled).toEqual({ value: "one", revision: before + 1 });
		});

		it("uses the longer delay once the ai toggle changes it", () => {
			const { result, type } = render();

			type("hello", { delayMs: DELAY * 2 });
			advance(DELAY);
			expect(result.current.settled.value).toBe("");

			advance(DELAY);
			expect(result.current.settled.value).toBe("hello");
		});
	});

	describe("flush", () => {
		it("applies the pending query at once when the search parameters change", () => {
			const { result, type } = render();
			type("hello");
			advance(100);

			type("hello", { flushOn: "next" });

			expect(result.current.settled).toEqual({ value: "hello", revision: 1 });
		});

		it("cancels the pending timer so the flushed query is not applied twice", () => {
			const { result, type } = render();
			type("hello");
			advance(100);
			type("hello", { flushOn: "next" });

			type("world", { flushOn: "next" });
			advance(DELAY - 1);

			expect(result.current.settled.value).toBe("hello");
		});
	});

	it("drops a pending update on unmount", () => {
		const { unmount, type } = render();
		type("hello");

		unmount();

		expect(() => advance(DELAY)).not.toThrow();
	});
});
