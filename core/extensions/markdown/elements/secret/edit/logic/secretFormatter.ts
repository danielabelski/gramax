import type { NodeSerializerSpec } from "@ext/markdown/core/edit/logic/Prosemirror/to_markdown";

/** Serializes the atomic secret node back to `${NAME.field}`. */
const secretFormatter: NodeSerializerSpec = (state, node) => {
	state.write(`\${${node.attrs.name}}`);
};

export default secretFormatter;
