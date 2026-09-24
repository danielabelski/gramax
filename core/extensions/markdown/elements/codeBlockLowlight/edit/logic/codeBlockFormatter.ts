import type { NodeSerializerSpec } from "../../../../core/edit/logic/Prosemirror/to_markdown";

const codeBlockFormatter: NodeSerializerSpec = (state, node) => {
	// Git conflict markers are the file's own raw text. Fences or escaping would leave a file
	// that git no longer reads as a conflict, so it goes back exactly as it came in.
	if (node.attrs.gitConflict) {
		state.text(node.textContent, false);
		state.closeBlock(node);
		return;
	}

	state.write(`\`\`\`${node.attrs.language || ""}\n`);
	state.text(node.textContent, false);
	state.ensureNewLine();
	state.write("```");
	state.closeBlock(node);
};

export default codeBlockFormatter;
