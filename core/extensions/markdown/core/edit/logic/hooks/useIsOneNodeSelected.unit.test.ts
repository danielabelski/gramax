/** biome-ignore-all lint/style/useNamingConvention: ProseMirror resolved positions use $from and $to */
import { act, renderHook } from "@testing-library/react";
import { useIsOneNodeSelected } from "./useIsOneNodeSelected";

const createSelection = (selected: boolean) => {
	const node = {};
	return {
		$from: { node: () => node },
		$to: { node: () => (selected ? node : {}) },
		content: () => ({ content: { size: selected ? 1 : 0 } }),
	};
};

const createEditor = (selected: boolean) => {
	let selectionUpdate: ({ editor }: { editor: unknown }) => void = () => {};
	const editor = {
		state: { selection: createSelection(selected) },
		on: jest.fn((_event: string, callback: typeof selectionUpdate) => {
			selectionUpdate = callback;
		}),
		off: jest.fn(),
		emitSelectionUpdate: () => selectionUpdate({ editor }),
	};

	return editor;
};

describe("useIsOneNodeSelected", () => {
	it("uses the current selection when mounted after selectionUpdate", () => {
		const editor = createEditor(true);

		const { result } = renderHook(() => useIsOneNodeSelected(editor as never));

		expect(result.current).toBe(true);
	});

	it("updates when the selection changes", () => {
		const editor = createEditor(true);
		const { result } = renderHook(() => useIsOneNodeSelected(editor as never));

		editor.state.selection = createSelection(false);
		act(() => editor.emitSelectionUpdate());

		expect(result.current).toBe(false);
	});
});
