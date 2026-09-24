import type { RenderableTreeNode, RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import Tag from "@ext/markdown/core/render/logic/Markdoc/src/ast/tag";
import { formatSecretName } from "@ext/markdown/elements/secret/edit/logic/secretFields";
import { findSecretMatches, SECRET_HIGHLIGHT_CLASS } from "@ext/markdown/elements/secret/edit/logic/secretMatch";

const SKIP_TAG_NAMES = new Set(["pre"]);
const CODE_TAG_NAME = "code";

const isTag = (node: RenderableTreeNode): node is Tag =>
	typeof node === "object" && node !== null && (node as Tag).$$mdtype === "Tag";

/** Returns the split parts if `text` contains a secret, or null if it does not. */
const splitSecrets = (text: string, knownNames: readonly string[]): RenderableTreeNode[] | null => {
	const parts: RenderableTreeNode[] = [];
	let lastIndex = 0;

	for (const match of findSecretMatches(text, knownNames)) {
		if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
		parts.push(new Tag("span", { class: SECRET_HIGHLIGHT_CLASS }, [formatSecretName(match.name)]));
		lastIndex = match.index + match.length;
	}

	if (lastIndex === 0) return null;
	if (lastIndex < text.length) parts.push(text.slice(lastIndex));
	return parts;
};

const transformSecretNode = (
	node: RenderableTreeNode,
	knownNames: readonly string[],
): RenderableTreeNode | RenderableTreeNode[] => {
	if (typeof node === "string") return splitSecrets(node, knownNames) ?? node;
	if (!isTag(node)) return node;
	if (SKIP_TAG_NAMES.has(node.name)) return node;

	if (node.name === CODE_TAG_NAME) {
		const content = node.children.length === 1 && typeof node.children[0] === "string" ? node.children[0] : null;
		return (content !== null ? splitSecrets(content, knownNames) : null) ?? node;
	}

	const children = node.children.flatMap((child) => {
		const result = transformSecretNode(child, knownNames);
		return Array.isArray(result) ? result : [result];
	});

	return new Tag(node.name, node.attributes, children);
};

/** Walks an already-parsed Markdoc render tree and highlights `${NAME.field}` secret references for display in chat. */
export const highlightSecretsInChatMessage = (
	node: RenderableTreeNodes,
	knownNames: readonly string[],
): RenderableTreeNodes => {
	if (Array.isArray(node)) {
		return node.flatMap((child) => {
			const result = transformSecretNode(child, knownNames);
			return Array.isArray(result) ? result : [result];
		});
	}

	return transformSecretNode(node, knownNames);
};
