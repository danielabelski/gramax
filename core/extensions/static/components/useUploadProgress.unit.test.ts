import useUploadProgress from "@ext/static/components/useUploadProgress";
import type { UploadStatus } from "@ext/static/logic/CloudUploadStatus";
import { act, renderHook } from "@testing-library/react";

const POLL_INTERVAL_MS = 500;

const mockFetch = jest.fn<Promise<{ ok: boolean; json: () => Promise<UploadStatus> }>, [unknown]>();

jest.mock("@core-ui/ApiServices/FetchService", () => ({
	// biome-ignore lint/style/useNamingConvention: ESM interop flag
	__esModule: true,
	default: {
		fetch: (...args: unknown[]) => mockFetch(...(args as [unknown])),
	},
}));

jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	// biome-ignore lint/style/useNamingConvention: ESM interop flag
	__esModule: true,
	default: { value: { getUploadStatus: () => "catalog/cloud/getUploadStatus" } },
}));

/** Последний элемент «залипает»: сервер отдаёт его на все последующие опросы. */
let statuses: (UploadStatus | undefined)[] = [];

const render = (startUploading: boolean, setError?: (error: string) => void) =>
	renderHook((props: { startUploading: boolean }) => useUploadProgress(props.startUploading, setError), {
		initialProps: { startUploading },
	});

const tick = async (times = 1) => {
	for (let i = 0; i < times; i++) {
		await act(async () => {
			jest.advanceTimersByTime(POLL_INTERVAL_MS);
		});
	}
};

const polls = () => mockFetch.mock.calls.length;

beforeEach(() => {
	jest.useFakeTimers();
	statuses = [undefined];
	mockFetch.mockReset();
	mockFetch.mockImplementation(async () => {
		const status = statuses.length > 1 ? statuses.shift() : statuses[0];
		return { ok: true, json: async () => status };
	});
});

afterEach(() => {
	jest.useRealTimers();
});

describe("useUploadProgress", () => {
	describe("polling lifecycle", () => {
		test("polls the upload status every 500 ms and exposes the latest one", async () => {
			statuses = [{ status: "uploading", progress: { current: 3, total: 10 } }];
			const { result } = render(true);

			await tick(3);

			expect(polls()).toBe(3);
			expect(result.current).toEqual({ status: "uploading", progress: { current: 3, total: 10 } });
		});

		test("does not poll until publishing starts", async () => {
			render(false);

			await tick(4);

			expect(polls()).toBe(0);
		});

		test("stops polling once the status disappears — the server drops it when publishing ends", async () => {
			statuses = [{ status: "uploading" }, undefined];
			render(true);

			await tick(2);
			const pollsAtStop = polls();
			await tick(5);

			expect(pollsAtStop).toBe(2);
			expect(polls()).toBe(pollsAtStop);
			expect(jest.getTimerCount()).toBe(0);
		});

		test("keeps polling while the build phase has not published a status yet", async () => {
			statuses = [undefined];
			render(true);

			await tick(4);

			expect(polls()).toBe(4);
		});

		test("stops polling when startUploading is cleared", async () => {
			statuses = [{ status: "uploading" }];
			const { rerender } = render(true);

			await tick(2);
			rerender({ startUploading: false });
			const pollsAtStop = polls();
			await tick(5);

			expect(polls()).toBe(pollsAtStop);
			expect(jest.getTimerCount()).toBe(0);
		});

		test("clears the interval on unmount", async () => {
			statuses = [{ status: "uploading" }];
			const { unmount } = render(true);

			await tick(2);
			unmount();
			const pollsAtUnmount = polls();
			await tick(5);

			expect(polls()).toBe(pollsAtUnmount);
			expect(jest.getTimerCount()).toBe(0);
		});

		test("restarts polling for a second publication", async () => {
			statuses = [{ status: "uploading" }, undefined];
			const { result, rerender } = render(true);

			await tick(2);
			expect(jest.getTimerCount()).toBe(0);

			statuses = [{ status: "uploading", progress: { current: 1, total: 2 } }];
			rerender({ startUploading: false });
			rerender({ startUploading: true });
			await tick(1);

			expect(result.current).toEqual({ status: "uploading", progress: { current: 1, total: 2 } });
		});
	});

	describe("error status", () => {
		test("stops polling and reports the error message", async () => {
			statuses = [{ status: "error", error: "boom" }];
			const setError = jest.fn();
			const { result } = render(true, setError);

			await tick(1);
			const pollsAtStop = polls();
			await tick(3);

			expect(setError).toHaveBeenCalledWith("boom");
			expect(polls()).toBe(pollsAtStop);
			expect(jest.getTimerCount()).toBe(0);
			expect(result.current).toEqual({ status: "error", error: "boom" });
		});

		test("survives an error status when no error sink is passed", async () => {
			statuses = [{ status: "error", error: "boom" }];
			const { result } = render(true);

			await tick(1);

			expect(result.current).toEqual({ status: "error", error: "boom" });
			expect(jest.getTimerCount()).toBe(0);
		});

		test("keeps polling when a single request fails", async () => {
			mockFetch.mockRejectedValueOnce(new Error("network down"));
			statuses = [{ status: "uploading" }];
			const { result } = render(true);

			await tick(3);

			expect(polls()).toBe(3);
			expect(result.current).toEqual({ status: "uploading" });
		});
	});
});
