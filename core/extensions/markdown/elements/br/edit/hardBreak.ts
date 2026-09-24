import br from "@ext/markdown/elements/br/edit/model/brSchema";
import getExtensionOptions from "@ext/markdown/logic/getExtensionOptions";
import { mergeAttributes, Node } from "@tiptap/core";
import { splitBlock } from "prosemirror-commands";
import { Plugin, PluginKey } from "prosemirror-state";

interface HardBreakOptions {
	keepMarks: boolean;
	HTMLAttributes: Record<string, unknown>;
}

const HardBreak = Node.create<HardBreakOptions>({
	...getExtensionOptions({ schema: br, name: "hard_break" }),

	addOptions() {
		return {
			keepMarks: true,
			HTMLAttributes: {},
		};
	},

	parseHTML() {
		return [{ tag: "br" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["br", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
	},

	renderText() {
		return "\n";
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("Shift-Enter_br"),
				props: {
					handleKeyDown: (view, event) => {
						if (event.key === "Enter" && event.shiftKey) {
							const { $from } = view.state.selection;
							if ($from.parent.type.name === "code_block") {
								view.dispatch(view.state.tr.insertText("\n"));
								return true;
							}
							if ($from.parent.type.name === "paragraph") {
								const { hard_break } = view.state.schema.nodes;
								view.dispatch(view.state.tr.replaceSelectionWith(hard_break.create()).scrollIntoView());
								return true;
							}
							return splitBlock(view.state, view.dispatch);
						}
					},
				},
			}),
		];
	},
});

export default HardBreak;
