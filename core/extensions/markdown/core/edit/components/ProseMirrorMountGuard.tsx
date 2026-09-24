import type { Editor } from "@tiptap/core";
import { type PropsWithChildren, useInsertionEffect } from "react";

type ProseMirrorMountGuardProps = PropsWithChildren<{
	editor: Editor | null;
}>;

const ProseMirrorMountGuard = ({ children, editor }: ProseMirrorMountGuardProps) => {
	useInsertionEffect(() => {
		if (!editor || editor.isDestroyed) return;

		const style = editor.view.dom.style;
		if (style.overflowAnchor != null) return;
		const originalDescriptor = Object.getOwnPropertyDescriptor(style, "overflowAnchor");

		try {
			Object.defineProperty(style, "overflowAnchor", {
				configurable: true,
				value: "auto",
				writable: true,
			});
		} catch {
			return;
		}

		let restored = false;
		const restore = () => {
			if (restored) return;
			restored = true;
			if (originalDescriptor) Object.defineProperty(style, "overflowAnchor", originalDescriptor);
			else delete style.overflowAnchor;
		};

		queueMicrotask(restore);
		return restore;
	}, [editor]);

	return children;
};

export default ProseMirrorMountGuard;
