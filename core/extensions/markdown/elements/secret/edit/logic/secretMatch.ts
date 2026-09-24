import { SECRET_FIELDS } from "@ext/markdown/elements/secret/edit/logic/secretFields";
import type { Node as ProsemirrorNode } from "prosemirror-model";

export type SecretMatchRange = { from: number; to: number };

export type SecretMatch = { index: number; length: number; name: string };

const SECRET_FIELD_RE = new RegExp(`\\.(${SECRET_FIELDS.join("|")})$`);
const SECRET_PLACEHOLDER_RE = /\$(\$?)\{([^}]+)\}/g;

export const findSecretMatches = (text: string, knownNames: readonly string[]): SecretMatch[] => {
	if (!knownNames.length) return [];

	const matches: SecretMatch[] = [];
	const known = new Set(knownNames);
	SECRET_PLACEHOLDER_RE.lastIndex = 0;
	for (const match of text.matchAll(SECRET_PLACEHOLDER_RE)) {
		const [full, escape, ref] = match;
		const field = SECRET_FIELD_RE.exec(ref);
		const key = field ? ref.slice(0, -field[0].length) : null;
		if (escape || !key || !known.has(key)) continue;
		matches.push({ index: match.index, length: full.length, name: ref });
	}

	return matches;
};

/** Matches the InlineProperty look (dashed underline) so secrets read as variables. */
export const SECRET_HIGHLIGHT_CLASS = "border-b-2 border-dashed border-[var(--color-comment-bg)]";

export type PositionedSecretMatch = { dollarStart: number; nameStart: number; nameEnd: number; name: string };

/** Scans the textblocks overlapping `[range.from, range.to)` (the whole doc by default) for secret
 *  matches — `nodesBetween` only visits nodes overlapping the given range instead of walking the whole
 *  document tree like `descendants`. Note this returns *every* match in a touched textblock, not just
 *  ones inside `range` itself — a match never spans two textblocks, so once a block is touched at all,
 *  its full text is rescanned. Callers that reassemble a decoration set from the result (rather than
 *  just testing a specific position/range for overlap, as everyone else here does) must pass a range
 *  that already covers full textblock bounds, or they'll duplicate matches lying just outside it. */
export const collectPositionedSecretMatches = (
	doc: ProsemirrorNode,
	knownNames: readonly string[],
	range?: SecretMatchRange,
): PositionedSecretMatch[] => {
	if (!knownNames.length) return [];

	const { from, to } = range ?? { from: 0, to: doc.content.size };
	const matches: PositionedSecretMatch[] = [];

	doc.nodesBetween(from, to, (node, pos) => {
		if (!node.isTextblock) return;

		const parts: string[] = [];
		const indexToPos: number[] = [];

		doc.nodesBetween(pos + 1, pos + node.nodeSize - 1, (innerNode, innerPos) => {
			if (!innerNode.isText) return;
			const text = innerNode.text ?? "";
			for (let i = 0; i < text.length; i++) indexToPos.push(innerPos + i);
			parts.push(text);
		});

		const blockText = parts.join("");
		if (!blockText) return false;

		for (const match of findSecretMatches(blockText, knownNames)) {
			const dollarStart = indexToPos[match.index];
			const matchEnd = indexToPos[match.index + match.length - 1] + 1;
			matches.push({
				dollarStart,
				nameStart: dollarStart + 2,
				nameEnd: matchEnd,
				name: match.name,
			});
		}

		return false;
	});

	return matches;
};

/** Whether `[from, to)` sits inside a code_block node or is covered by the inline `code` mark. */
export const isSecretCodeContext = (doc: ProsemirrorNode, from: number, to: number): boolean => {
	const resolvedPos = doc.resolve(from);
	const codeMark = doc.type.schema.marks.code;
	const codeBlock = doc.type.schema.nodes.code_block;
	return (
		(codeBlock ? resolvedPos.parent.type === codeBlock : false) ||
		(codeMark ? doc.rangeHasMark(from, to, codeMark) : false)
	);
};
