import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Pins an open dropdown to the place it was opened, and returns the ref to put on its trigger.
 *
 * Radix positions its content against the trigger and, through floating-ui's `autoUpdate`,
 * follows it whenever it moves — so a menu whose own items reflow the row its trigger sits in
 * slides out from under the pointer. While the menu is open the trigger reports the rect it
 * had at that moment, so every reposition lands on the same spot. Closing restores live
 * measurement, and the next open lands wherever the trigger is by then.
 */
export const useFrozenDropdownPosition = <T extends HTMLElement>(open: boolean): RefObject<T> => {
	const triggerRef = useRef<T>(null);

	useLayoutEffect(() => {
		const trigger = triggerRef.current;
		if (!open || !trigger) return;

		const frozen = trigger.getBoundingClientRect();
		trigger.getBoundingClientRect = () => frozen;

		return () => {
			delete (trigger as Partial<T>).getBoundingClientRect;
		};
	}, [open]);

	return triggerRef;
};
