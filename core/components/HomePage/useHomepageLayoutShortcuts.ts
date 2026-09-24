import { useEffect } from "react";
import { useHomepageLayoutStore } from "./store/homepageLayoutStore";

export const useHomepageLayoutShortcuts = (enabled: boolean) => {
	const undo = useHomepageLayoutStore((state) => state.undo);
	const redo = useHomepageLayoutStore((state) => state.redo);

	useEffect(() => {
		if (!enabled) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			const key = event.key.toLowerCase();
			const code = event.code;
			const hasMod = event.metaKey || event.ctrlKey;
			const isUndoShortcut = hasMod && !event.shiftKey && (key === "z" || code === "KeyZ");
			const isRedoShortcut =
				hasMod && ((event.shiftKey && (key === "z" || code === "KeyZ")) || key === "y" || code === "KeyY");

			if (!isUndoShortcut && !isRedoShortcut) return;

			const target = event.target as HTMLElement | null;
			const isEditableTarget =
				target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

			if (isEditableTarget) return;

			const store = useHomepageLayoutStore.getState();

			if (isUndoShortcut) {
				if (!store.canUndo()) return;
				event.preventDefault();
				undo();
				return;
			}

			if (!store.canRedo()) return;
			event.preventDefault();
			redo();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [enabled, undo, redo]);
};
