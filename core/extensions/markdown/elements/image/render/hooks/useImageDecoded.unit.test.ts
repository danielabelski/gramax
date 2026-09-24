import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import useImageDecoded from "./useImageDecoded";

const deferred = () => {
	let resolve: () => void;
	let reject: () => void;
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});

	return { promise, resolve: resolve!, reject: reject! };
};

const makeImageRef = (decode: () => Promise<void>, image?: HTMLImageElement) => {
	const ref = createRef<HTMLImageElement>();
	const element = image ?? document.createElement("img");
	element.decode = decode;
	// @ts-expect-error test setup assigns the element before render
	ref.current = element;
	return ref;
};

describe("useImageDecoded", () => {
	it("stays false until the current image finishes decoding", async () => {
		const decoding = deferred();
		const ref = makeImageRef(() => decoding.promise);
		const { result } = renderHook(() => useImageDecoded(ref, "blob:first"));

		expect(result.current).toBe(false);

		await act(async () => decoding.resolve());

		expect(result.current).toBe(true);
	});

	it("ignores completion from an outdated src", async () => {
		const firstDecode = deferred();
		const secondDecode = deferred();
		const decode = jest.fn().mockReturnValueOnce(firstDecode.promise).mockReturnValueOnce(secondDecode.promise);
		const ref = makeImageRef(decode);
		const { result, rerender } = renderHook(({ src }) => useImageDecoded(ref, src), {
			initialProps: { src: "blob:first" },
		});

		rerender({ src: "blob:second" });
		await act(async () => firstDecode.resolve());

		expect(result.current).toBe(false);

		await act(async () => secondDecode.resolve());

		expect(result.current).toBe(true);
	});

	it("falls back to the load event when decode rejects", async () => {
		const decoding = deferred();
		const image = document.createElement("img");
		const ref = makeImageRef(() => decoding.promise, image);
		const { result } = renderHook(() => useImageDecoded(ref, "blob:broken"));

		await act(async () => decoding.reject());
		expect(result.current).toBe(false);

		act(() => image.dispatchEvent(new Event("load")));

		expect(result.current).toBe(true);
	});
});
