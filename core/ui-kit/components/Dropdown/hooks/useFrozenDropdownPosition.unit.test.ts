import { renderHook } from "@testing-library/react";
import { useFrozenDropdownPosition } from "@ui-kit/Dropdown/hooks/useFrozenDropdownPosition";
import type { MutableRefObject } from "react";

let liveTop = 0;
const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;

/** jsdom measures everything as zero, so stand in a rect the test can move. */
beforeEach(() => {
	liveTop = 10;
	Element.prototype.getBoundingClientRect = () =>
		({ top: liveTop, bottom: liveTop + 20, left: 0, right: 30, width: 30, height: 20 }) as DOMRect;
});

afterEach(() => {
	Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
});

/** Mounts the trigger first, the way it exists before the menu is ever opened. */
const render = () => {
	const { result, rerender } = renderHook(
		(props: { open: boolean }) => useFrozenDropdownPosition<HTMLElement>(props.open),
		{
			initialProps: { open: false },
		},
	);

	const trigger = document.createElement("button");
	(result.current as MutableRefObject<HTMLElement>).current = trigger;

	return { trigger, open: () => rerender({ open: true }), close: () => rerender({ open: false }) };
};

const topOf = (trigger: HTMLElement) => trigger.getBoundingClientRect().top;

describe("useFrozenDropdownPosition", () => {
	it("measures live while the menu is closed", () => {
		const { trigger } = render();

		liveTop = 40;

		expect(topOf(trigger)).toBe(40);
	});

	it("keeps reporting the rect the trigger had when the menu opened", () => {
		const { trigger, open } = render();
		open();

		liveTop = 40;

		expect(topOf(trigger)).toBe(10);
	});

	it("measures live again once the menu closes", () => {
		const { trigger, open, close } = render();
		open();
		liveTop = 40;

		close();

		expect(topOf(trigger)).toBe(40);
	});

	it("freezes at the new place the next time the menu opens", () => {
		const { trigger, open, close } = render();
		open();
		close();
		liveTop = 40;

		open();
		liveTop = 90;

		expect(topOf(trigger)).toBe(40);
	});

	it("leaves nothing of its own on the trigger after closing", () => {
		const { trigger, open, close } = render();
		open();

		close();

		expect(Object.hasOwn(trigger, "getBoundingClientRect")).toBe(false);
	});

	it("stops freezing when the trigger unmounts mid-open", () => {
		const { result, rerender, unmount } = renderHook(
			(props: { open: boolean }) => useFrozenDropdownPosition<HTMLElement>(props.open),
			{ initialProps: { open: false } },
		);
		const trigger = document.createElement("button");
		(result.current as MutableRefObject<HTMLElement>).current = trigger;
		rerender({ open: true });

		unmount();
		liveTop = 40;

		expect(topOf(trigger)).toBe(40);
	});
});
