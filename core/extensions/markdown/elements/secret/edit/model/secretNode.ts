import SecretComponent from "@ext/markdown/elements/secret/edit/components/SecretComponent";
import { createSecretCodeHighlightPlugin } from "@ext/markdown/elements/secret/edit/logic/secretCodeHighlightPlugin";
import {
	collectPositionedSecretMatches,
	isSecretCodeContext,
	SECRET_HIGHLIGHT_CLASS,
} from "@ext/markdown/elements/secret/edit/logic/secretMatch";
import secretSchema from "@ext/markdown/elements/secret/edit/model/secretSchema";
import getExtensionOptions from "@ext/markdown/logic/getExtensionOptions";
import { type Editor, mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export type SecretNodeOptions = { knownNames: string[] };

export const SECRET_NODE_NAME = "secret";

/** Same check as the code-block plugin, plus a collapsed-cursor fallback via `storedMarks` — needed here because a command can fire with no selection. */
const isCodeContext = (state: Editor["state"], from: number, to: number): boolean => {
	if (isSecretCodeContext(state.doc, from, to)) return true;
	if (from !== to) return false;
	const codeMark = state.schema.marks.code;
	return Boolean(codeMark?.isInSet(state.storedMarks ?? state.doc.resolve(from).marks()));
};

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		secret: {
			setSecret: (attrs: { name: string }) => ReturnType;
		};
	}
}

/** One-time upgrade of plain `${NAME.field}` text into atomic secret nodes. */
const convertExistingSecretsToNodes = (editor: Editor, knownNames: readonly string[]) => {
	const { state, view } = editor;
	const nodeType = state.schema.nodes.secret;
	if (!nodeType) return;

	const matches = collectPositionedSecretMatches(state.doc, knownNames).filter(
		({ dollarStart, nameEnd }) => !isCodeContext(state, dollarStart, nameEnd),
	);
	if (!matches.length) return;

	let tr = state.tr;
	for (let i = matches.length - 1; i >= 0; i--) {
		const { dollarStart, nameEnd, name } = matches[i];
		const marks = state.doc.resolve(dollarStart).marks();
		tr = tr.replaceWith(dollarStart, nameEnd, nodeType.create({ name }, null, marks));
	}
	tr.setMeta("addToHistory", false);
	view.dispatch(tr);
};

/** Atomic inline node for `${NAME.field}` secret references in the skill editor. */
const SecretNode = Node.create<SecretNodeOptions>({
	...getExtensionOptions({ schema: secretSchema, name: SECRET_NODE_NAME }),

	addOptions() {
		return { knownNames: [] };
	},

	parseHTML() {
		return [{ tag: "gr-secret" }];
	},

	renderHTML({ node, HTMLAttributes }) {
		return ["gr-secret", mergeAttributes(HTMLAttributes, { class: SECRET_HIGHLIGHT_CLASS }), node.attrs.name];
	},

	onCreate() {
		convertExistingSecretsToNodes(this.editor, this.options.knownNames);
	},

	addNodeView() {
		return ReactNodeViewRenderer(SecretComponent);
	},

	addProseMirrorPlugins() {
		return [createSecretCodeHighlightPlugin(() => this.options.knownNames)];
	},

	addCommands() {
		return {
			setSecret:
				(attrs) =>
				({ commands, dispatch, state }) => {
					const { from, to } = state.selection;

					if (isCodeContext(state, from, to)) {
						const text = `\${${attrs.name}}`;
						const codeMark = state.schema.marks.code;
						if (!dispatch) return true;

						if (state.selection.$from.parent.type === state.schema.nodes.code_block || !codeMark) {
							dispatch(state.tr.insertText(text, from, to));
							return true;
						}

						dispatch(state.tr.replaceSelectionWith(state.schema.text(text, [codeMark.create()])));
						return true;
					}

					return commands.insertContent({ type: this.name, attrs });
				},
		};
	},
});

export default SecretNode;
