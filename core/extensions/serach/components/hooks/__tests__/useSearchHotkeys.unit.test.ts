import { type UseSearchHotkeysArgs, useSearchHotkeys } from "@ext/serach/components/hooks/useSearchHotkeys";
import { renderHook } from "@testing-library/react";

const render = (overrides: Partial<UseSearchHotkeysArgs> = {}) => {
	const onToggleOpen = jest.fn();
	const onCycleScope = jest.fn();
	const result = renderHook(() => useSearchHotkeys({ onToggleOpen, onCycleScope, ...overrides }));
	return { ...result, onToggleOpen, onCycleScope };
};

const press = (init: KeyboardEventInit) => {
	const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
	document.dispatchEvent(event);
	return event;
};

describe("useSearchHotkeys", () => {
	it("toggles the dialog on ctrl+slash and cmd+slash", () => {
		const { onToggleOpen } = render();

		press({ code: "Slash", ctrlKey: true });
		press({ code: "Slash", metaKey: true });

		expect(onToggleOpen).toHaveBeenCalledTimes(2);
	});

	it("cycles the scope on ctrl+enter", () => {
		const { onCycleScope } = render();

		press({ code: "Enter", ctrlKey: true });

		expect(onCycleScope).toHaveBeenCalledTimes(1);
	});

	it("ignores the same keys without a modifier", () => {
		const { onToggleOpen, onCycleScope } = render();

		press({ code: "Slash" });
		press({ code: "Enter" });

		expect(onToggleOpen).not.toHaveBeenCalled();
		expect(onCycleScope).not.toHaveBeenCalled();
	});

	it("prevents the browser default for handled combos", () => {
		render();

		expect(press({ code: "Slash", ctrlKey: true }).defaultPrevented).toBe(true);
		expect(press({ code: "KeyA", ctrlKey: true }).defaultPrevented).toBe(false);
	});

	it("stops listening after unmount", () => {
		const { unmount, onToggleOpen } = render();
		unmount();

		press({ code: "Slash", ctrlKey: true });

		expect(onToggleOpen).not.toHaveBeenCalled();
	});
});
