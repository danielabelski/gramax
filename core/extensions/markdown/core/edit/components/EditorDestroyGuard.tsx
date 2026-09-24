import type { Editor } from "@tiptap/core";
import { Component, type PropsWithChildren } from "react";

type EditorDestroyGuardProps = PropsWithChildren<{
	editor: Editor | null;
}>;

class EditorDestroyGuard extends Component<EditorDestroyGuardProps> {
	componentWillUnmount() {
		const { editor } = this.props;
		if (!editor || editor.isDestroyed) return;

		editor.destroy();
	}

	render() {
		return this.props.children;
	}
}

export default EditorDestroyGuard;
