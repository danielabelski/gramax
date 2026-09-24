import type { SearchState } from "@ext/serach/components/hooks/useSearchState";
import { type KeyboardEvent, type RefObject, useCallback, useRef } from "react";

const ARROW_CODES = ["ArrowUp", "ArrowDown"];

export interface SearchKeyboard {
	inputRef: RefObject<HTMLInputElement>;
	onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * The dialog reads list navigation in one place, so a click on a filter dropdown does not
 * leave the arrow keys stranded on whatever took DOM focus: the first arrow hands focus
 * back to the query input and moves the result focus with it. Keys another handler already
 * claimed are left alone, and outside the input only the arrows are taken — Enter still
 * belongs to the button or menu item the user is standing on.
 */
export const useSearchKeyboard = (state: SearchState): SearchKeyboard => {
	const inputRef = useRef<HTMLInputElement>(null);
	const focus = state.aiEnabled === false ? state.focus : undefined;

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			if (!focus || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

			const fromInput = event.target === inputRef.current;
			if (!fromInput && !ARROW_CODES.includes(event.code)) return;
			if (!focus.handleKeyDown(event)) return;

			event.preventDefault();
			if (!fromInput) inputRef.current?.focus();
		},
		[focus],
	);

	return { inputRef, onKeyDown };
};
