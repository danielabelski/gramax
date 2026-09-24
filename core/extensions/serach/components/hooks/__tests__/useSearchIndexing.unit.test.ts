import { type UseSearchIndexingArgs, useSearchIndexing } from "@ext/serach/components/hooks/useSearchIndexing";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createFakeGateway, createNdjsonStream } from "../../model/__tests__/fixtures";

const render = (overrides: Partial<UseSearchIndexingArgs> = {}) => {
	const gateway = createFakeGateway();
	const stream = createNdjsonStream();
	gateway.indexingProgress.mockResolvedValue(stream.reader);

	const onComplete = jest.fn();
	const initialProps: UseSearchIndexingArgs = {
		gateway,
		enabled: true,
		reindexOnOpen: false,
		resourceFilter: "with",
		onComplete,
		...overrides,
	};

	const result = renderHook((args: UseSearchIndexingArgs) => useSearchIndexing(args), { initialProps });
	return { ...result, gateway, stream, onComplete, initialProps };
};

describe("useSearchIndexing", () => {
	it("reports nothing in progress before any update", () => {
		const { result } = render();

		expect(result.current).toEqual({ inProgress: false, progress: 1 });
	});

	describe("reindex on open", () => {
		it("resets the index before streaming where the index is local", async () => {
			const { gateway } = render({ reindexOnOpen: true, catalogName: "docs" });

			await waitFor(() => expect(gateway.resetIndex).toHaveBeenCalledWith("docs"));
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalledTimes(1));
		});

		it("only streams where the index is remote", async () => {
			const { gateway } = render();

			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalledTimes(1));
			expect(gateway.resetIndex).not.toHaveBeenCalled();
		});
	});

	describe("progress stream", () => {
		it("tracks partial progress", async () => {
			const { result, stream, gateway } = render();
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalled());

			await act(() => stream.push({ type: "progress", progress: 0.4 }));

			expect(result.current).toEqual({ inProgress: true, progress: 0.4 });
		});

		it("completes and reports it once done arrives", async () => {
			const { result, stream, gateway, onComplete } = render();
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalled());
			await act(() => stream.push({ type: "progress", progress: 0.4 }));

			await act(() => stream.push({ type: "done" }));

			expect(result.current).toEqual({ inProgress: false, progress: 1 });
			expect(onComplete).toHaveBeenCalledTimes(1);
		});

		it("reports a completed run once, however many done items follow it", async () => {
			const { stream, gateway, onComplete } = render();
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalled());
			await act(() => stream.push({ type: "progress", progress: 0.4 }));
			await act(() => stream.push({ type: "done" }));

			for (let beat = 0; beat < 5; beat++) await act(() => stream.push({ type: "done" }));

			expect(onComplete).toHaveBeenCalledTimes(1);
		});

		it("reports nothing for a stream that only ever beats done", async () => {
			const { stream, gateway, onComplete } = render();
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalled());

			for (let beat = 0; beat < 5; beat++) await act(() => stream.push({ type: "done" }));

			expect(onComplete).not.toHaveBeenCalled();
		});
	});

	describe("lifecycle", () => {
		it("does not touch the index while closed", () => {
			const { gateway } = render({ enabled: false });

			expect(gateway.indexingProgress).not.toHaveBeenCalled();
		});

		it("aborts the stream when the dialog closes", async () => {
			const { rerender, gateway, initialProps } = render();
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalled());

			rerender({ ...initialProps, enabled: false });

			expect(gateway.lastSignal().aborted).toBe(true);
		});

		it("aborts the stream on unmount", async () => {
			const { unmount, gateway } = render();
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalled());

			unmount();

			expect(gateway.lastSignal().aborted).toBe(true);
		});

		it("restarts the stream when the resource filter changes", async () => {
			const { rerender, gateway, initialProps } = render();
			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalledTimes(1));

			rerender({ ...initialProps, resourceFilter: "only" });

			await waitFor(() => expect(gateway.indexingProgress).toHaveBeenCalledTimes(2));
			expect(gateway.indexingProgress).toHaveBeenLastCalledWith("only", expect.any(AbortSignal));
		});
	});
});
