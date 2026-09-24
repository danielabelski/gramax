import softBreak from "@ext/markdown/elements/br/edit/model/softBreakSchema";
import getExtensionOptions from "@ext/markdown/logic/getExtensionOptions";
import { Node } from "@tiptap/core";

// A soft line break coming from the markdown source ("\n" inside a paragraph).
// Rendered and searched as a plain space, serialized back to "\n" so that
// paragraphs split by sentences keep their line structure in the file.
const SoftBreak = Node.create({
	...getExtensionOptions({ schema: softBreak, name: "soft_break" }),

	parseHTML() {
		return [{ tag: "span[data-soft-break]" }];
	},

	renderHTML() {
		return ["span", { "data-soft-break": "true" }, " "];
	},

	renderText() {
		return " ";
	},

	// tiptap maps renderText to spec.toText only; node.textContent (diff engine,
	// search) reads spec.leafText, so it has to be injected into the schema directly.
	extendNodeSchema(extension) {
		return extension.name === "soft_break" ? { leafText: () => " " } : {};
	},
});

export default SoftBreak;
