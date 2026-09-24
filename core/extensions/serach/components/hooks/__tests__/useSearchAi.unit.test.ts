import { type UseSearchAiArgs, useSearchAi } from "@ext/serach/components/hooks/useSearchAi";
import { act, renderHook, waitFor } from "@testing-library/react";

const render = (overrides: Partial<UseSearchAiArgs> = {}) => {
	const checkAvailable = overrides.checkAvailable ?? jest.fn(async () => true);
	const result = renderHook(() => useSearchAi({ configured: true, probe: false, ...overrides, checkAvailable }));
	return { ...result, checkAvailable };
};

describe("useSearchAi", () => {
	it("is unavailable and never probes when ai is not configured", () => {
		const { result, checkAvailable } = render({ configured: false, probe: true });

		expect(result.current.available).toBe(false);
		expect(checkAvailable).not.toHaveBeenCalled();
	});

	it("is available without probing where the server is known to support it", () => {
		const { result, checkAvailable } = render();

		expect(result.current.available).toBe(true);
		expect(checkAvailable).not.toHaveBeenCalled();
	});

	it("stays unavailable until the probe answers", async () => {
		const { result, checkAvailable } = render({ probe: true });

		expect(result.current.available).toBe(false);
		await waitFor(() => expect(result.current.available).toBe(true));
		expect(checkAvailable).toHaveBeenCalledTimes(1);
	});

	it("stays unavailable when the probe says no", async () => {
		const { result } = render({ probe: true, checkAvailable: jest.fn(async () => false) });

		await waitFor(() => expect(result.current.available).toBe(false));
	});

	it("toggles while available", () => {
		const { result } = render();

		act(() => result.current.toggle());
		expect(result.current.enabled).toBe(true);

		act(() => result.current.toggle());
		expect(result.current.enabled).toBe(false);
	});

	it("cannot be toggled on while unavailable", () => {
		const { result } = render({ configured: false });

		act(() => result.current.toggle());

		expect(result.current.enabled).toBe(false);
	});
});
