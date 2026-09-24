import { useSearchKeyboard } from "@ext/serach/components/hooks/useSearchKeyboard";
import type { SearchFocus } from "@ext/serach/components/hooks/useSearchResults";
import type { SearchState } from "@ext/serach/components/hooks/useSearchState";
import { renderHook } from "@testing-library/react";
import type { KeyboardEvent, MutableRefObject } from "react";

interface KeyOverrides {
	defaultPrevented?: boolean;
	altKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
}

const render = (args: { aiEnabled?: boolean; handled?: boolean } = {}) => {
	const handleKeyDown = jest.fn(() => args.handled ?? true);
	const focus = { handleKeyDown } as unknown as SearchFocus;
	const state = { aiEnabled: args.aiEnabled ?? false, focus } as unknown as SearchState;

	const { result } = renderHook(() => useSearchKeyboard(state));

	const input = document.createElement("input");
	(result.current.inputRef as MutableRefObject<HTMLInputElement>).current = input;
	document.body.appendChild(input);
	const outside = document.createElement("button");
	document.body.appendChild(outside);

	const press = (code: string, target: EventTarget, overrides: KeyOverrides = {}) => {
		const preventDefault = jest.fn();
		const event = {
			code,
			target,
			preventDefault,
			defaultPrevented: false,
			altKey: false,
			ctrlKey: false,
			metaKey: false,
			...overrides,
		} as unknown as KeyboardEvent<HTMLElement>;

		result.current.onKeyDown(event);
		return preventDefault;
	};

	return { press, input, outside, handleKeyDown };
};

afterEach(() => {
	document.body.innerHTML = "";
});

describe("useSearchKeyboard", () => {
	it("moves the result focus on an arrow typed in the input", () => {
		const { press, input, handleKeyDown } = render();

		const preventDefault = press("ArrowDown", input);

		expect(handleKeyDown).toHaveBeenCalledWith(expect.objectContaining({ code: "ArrowDown" }));
		expect(preventDefault).toHaveBeenCalledTimes(1);
	});

	it("opens the focused result on enter typed in the input", () => {
		const { press, input, handleKeyDown } = render();

		const preventDefault = press("Enter", input);

		expect(handleKeyDown).toHaveBeenCalledWith(expect.objectContaining({ code: "Enter" }));
		expect(preventDefault).toHaveBeenCalledTimes(1);
	});

	it("leaves a key the results do not use to the input", () => {
		const { press, input } = render({ handled: false });

		const preventDefault = press("KeyA", input);

		expect(preventDefault).not.toHaveBeenCalled();
	});

	it("takes an arrow pressed somewhere else and hands focus back to the input", () => {
		const { press, outside, input, handleKeyDown } = render();

		const preventDefault = press("ArrowUp", outside);

		expect(handleKeyDown).toHaveBeenCalledWith(expect.objectContaining({ code: "ArrowUp" }));
		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(input);
	});

	it("leaves enter to whatever holds focus outside the input", () => {
		const { press, outside, handleKeyDown } = render();

		const preventDefault = press("Enter", outside);

		expect(handleKeyDown).not.toHaveBeenCalled();
		expect(preventDefault).not.toHaveBeenCalled();
	});

	it("stays out of the way of a handler that already claimed the key", () => {
		const { press, outside, handleKeyDown } = render();

		press("ArrowDown", outside, { defaultPrevented: true });

		expect(handleKeyDown).not.toHaveBeenCalled();
	});

	it.each([["altKey"], ["ctrlKey"], ["metaKey"]])("ignores %s combinations", (modifier) => {
		const { press, input, handleKeyDown } = render();

		press("Enter", input, { [modifier]: true });

		expect(handleKeyDown).not.toHaveBeenCalled();
	});

	it("takes no keys while the ai answer is showing", () => {
		const { press, input, handleKeyDown } = render({ aiEnabled: true });

		const preventDefault = press("ArrowDown", input);

		expect(handleKeyDown).not.toHaveBeenCalled();
		expect(preventDefault).not.toHaveBeenCalled();
	});
});
