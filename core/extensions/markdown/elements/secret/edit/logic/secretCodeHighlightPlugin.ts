import { formatSecretName } from "@ext/markdown/elements/secret/edit/logic/secretFields";
import {
	collectPositionedSecretMatches,
	isSecretCodeContext,
	SECRET_HIGHLIGHT_CLASS,
	type SecretMatchRange,
} from "@ext/markdown/elements/secret/edit/logic/secretMatch";
import type { Node as ProsemirrorNode } from "prosemirror-model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

type SecretCodeRange = { from: number; to: number };

const collectSecretCodeRanges = (
	doc: ProsemirrorNode,
	knownNames: readonly string[],
	range?: SecretMatchRange,
): SecretCodeRange[] =>
	collectPositionedSecretMatches(doc, knownNames, range)
		.filter(({ dollarStart, nameEnd }) => isSecretCodeContext(doc, dollarStart, nameEnd))
		.map(({ dollarStart, nameEnd }) => ({ from: dollarStart, to: nameEnd }));

const isPartialRangeChange = (changeFrom: number, changeTo: number, range: SecretCodeRange): boolean => {
	if (changeFrom === changeTo) return changeFrom > range.from && changeFrom < range.to;
	if (changeTo <= range.from || changeFrom >= range.to) return false;
	return !(changeFrom <= range.from && changeTo >= range.to);
};

/** Expands a ranged (non-empty) change to fully cover any secret it partially overlaps. Point changes are left untouched — those are rejected outright by `isPartialRangeChange` instead. */
const expandToSecretRanges = (
	doc: ProsemirrorNode,
	knownNames: readonly string[],
	from: number,
	to: number,
): SecretCodeRange => {
	if (from === to) return { from, to };

	let expandedFrom = from;
	let expandedTo = to;
	for (const range of collectSecretCodeRanges(doc, knownNames, { from, to })) {
		if (to <= range.from || from >= range.to) continue;
		expandedFrom = Math.min(expandedFrom, range.from);
		expandedTo = Math.max(expandedTo, range.to);
	}
	return { from: expandedFrom, to: expandedTo };
};

const findRangeForSecretCodeDelete = (
	doc: ProsemirrorNode,
	knownNames: readonly string[],
	pos: number,
	key: string,
): SecretCodeRange | undefined =>
	collectSecretCodeRanges(doc, knownNames, { from: pos, to: pos }).find((range) =>
		key === "Backspace" ? pos > range.from && pos <= range.to : pos >= range.from && pos < range.to,
	);

const buildSecretCodeDecorationArray = (
	doc: ProsemirrorNode,
	knownNames: readonly string[],
	range?: SecretMatchRange,
): Decoration[] =>
	collectPositionedSecretMatches(doc, knownNames, range).flatMap(({ dollarStart, nameEnd, name }) => {
		if (!isSecretCodeContext(doc, dollarStart, nameEnd)) return [];

		return [
			// Raw "${key.field}" stays in the doc (code must round-trip literally) but is hidden — the widget
			// below shows the localized field label (e.g. "key.Токен") in its place.
			Decoration.inline(dollarStart, nameEnd, { style: "display: none" }),
			Decoration.widget(
				dollarStart,
				() => {
					const span = document.createElement("span");
					span.className = SECRET_HIGHLIGHT_CLASS;
					span.textContent = formatSecretName(name);
					return span;
				},
				{ key: `secretCodeLabel-${dollarStart}-${name}` },
			),
		];
	});

const buildSecretCodeDecorations = (doc: ProsemirrorNode, knownNames: readonly string[]): DecorationSet =>
	DecorationSet.create(doc, buildSecretCodeDecorationArray(doc, knownNames));

/** The final-doc `[from, to]` envelope touched by `tr`, or `null` for a transaction with no steps.
 *  Each step's touched positions are mapped forward through the *remaining* steps (`mapping.slice`)
 *  to land in final-doc coordinates, so multi-step transactions are handled correctly, not just the
 *  common single-step case. */
const getTouchedRange = (tr: Transaction): SecretMatchRange | null => {
	let from = Infinity;
	let to = -Infinity;

	tr.mapping.maps.forEach((stepMap, index) => {
		const rest = tr.mapping.slice(index + 1);
		stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
			from = Math.min(from, rest.map(newStart, -1));
			to = Math.max(to, rest.map(newEnd, 1));
		});
	});

	return from <= to ? { from, to } : null;
};

/** Widens `range` to the full bounds of every textblock it overlaps. `collectPositionedSecretMatches`
 *  always rescans a touched textblock's whole text (a match can't span two blocks), so a range narrower
 *  than the block would make it return matches lying outside the range too — reusing that result to
 *  rebuild a `DecorationSet` (remove old + add new for just `range`) would then duplicate whatever
 *  those extra matches decorate, since they'd never have been removed. Passing exact block bounds keeps
 *  the removed and re-added spans identical to what the rescan actually reflects. */
const widenToTextblockBounds = (doc: ProsemirrorNode, range: SecretMatchRange): SecretMatchRange => {
	let from = Infinity;
	let to = -Infinity;

	doc.nodesBetween(range.from, range.to, (node, pos) => {
		if (!node.isTextblock) return;
		from = Math.min(from, pos + 1);
		to = Math.max(to, pos + node.nodeSize - 1);
		return false;
	});

	return from <= to ? { from, to } : range;
};

type SecretCodeHighlightPluginState = { decorations: DecorationSet };

export const secretCodeHighlightPluginKey = new PluginKey<SecretCodeHighlightPluginState>("secretCodeHighlight");

/** The code-block variant of the secret node — `${NAME.field}` written as raw text inside a
 *  code_block/code mark, where an atomic node can't be inserted. Registered as a ProseMirror plugin
 *  from `SecretNode.addProseMirrorPlugins()` rather than as its own extension, since it's not a
 *  separate feature, just how the same node behaves in a code context. */
export const createSecretCodeHighlightPlugin = (getKnownNames: () => readonly string[]) =>
	new Plugin<SecretCodeHighlightPluginState>({
		key: secretCodeHighlightPluginKey,
		state: {
			init: (_, { doc }) => ({ decorations: buildSecretCodeDecorations(doc, getKnownNames()) }),
			// A pure selection/cursor move (no doc change) skips this entirely — that used to be the most
			// common trigger for a full-document rescan. On an actual edit, only the touched textblock(s)
			// are rebuilt: existing decorations are shifted forward via `.map()` (cheap, no rescan), then
			// that block's decorations are cleared and recomputed — matching `collectPositionedSecretMatches`'s
			// own block-at-a-time granularity so nothing is duplicated or missed at the block's edges.
			apply: (tr, prev, _oldState, newState) => {
				if (!tr.docChanged) return prev;
				const knownNames = getKnownNames();
				if (!knownNames.length) return { decorations: DecorationSet.empty };

				let decorations = prev.decorations.map(tr.mapping, newState.doc);
				const touched = getTouchedRange(tr);
				if (touched) {
					const block = widenToTextblockBounds(newState.doc, touched);
					decorations = decorations.remove(decorations.find(block.from, block.to));
					decorations = decorations.add(
						newState.doc,
						buildSecretCodeDecorationArray(newState.doc, knownNames, block),
					);
				}

				return { decorations };
			},
		},
		filterTransaction: (transaction, state) => {
			if (!transaction.docChanged) return true;

			let doc: ProsemirrorNode | null = state.doc;
			for (const step of transaction.steps) {
				if (!doc) break;

				const touched: { oldStart: number; oldEnd: number }[] = [];
				step.getMap().forEach((oldStart, oldEnd) => touched.push({ oldStart, oldEnd }));

				if (touched.length) {
					const from = Math.min(...touched.map((t) => t.oldStart));
					const to = Math.max(...touched.map((t) => t.oldEnd));
					const ranges = collectSecretCodeRanges(doc, getKnownNames(), { from, to });
					const shouldReject = touched.some(({ oldStart, oldEnd }) =>
						ranges.some((range) => isPartialRangeChange(oldStart, oldEnd, range)),
					);
					if (shouldReject) return false;
				}

				doc = step.apply(doc).doc ?? null;
			}

			return true;
		},
		props: {
			decorations: (state) => secretCodeHighlightPluginKey.getState(state)?.decorations,
			handleKeyDown: (view, event) => {
				if (event.key !== "Backspace" && event.key !== "Delete") return false;
				const { selection } = view.state;

				if (selection.empty) {
					const range = findRangeForSecretCodeDelete(
						view.state.doc,
						getKnownNames(),
						selection.from,
						event.key,
					);
					if (!range) return false;
					view.dispatch(view.state.tr.delete(range.from, range.to));
					return true;
				}

				const { from, to } = expandToSecretRanges(
					view.state.doc,
					getKnownNames(),
					selection.from,
					selection.to,
				);
				if (from === selection.from && to === selection.to) return false;
				view.dispatch(view.state.tr.delete(from, to));
				return true;
			},
			handleTextInput: (view, from, to, text) => {
				const expanded = expandToSecretRanges(view.state.doc, getKnownNames(), from, to);
				if (expanded.from === from && expanded.to === to) return false;
				view.dispatch(view.state.tr.insertText(text, expanded.from, expanded.to));
				return true;
			},
			handlePaste: (view) => {
				const { selection } = view.state;
				if (selection.empty) return false;
				const expanded = expandToSecretRanges(view.state.doc, getKnownNames(), selection.from, selection.to);
				if (expanded.from === selection.from && expanded.to === selection.to) return false;
				view.dispatch(
					view.state.tr.setSelection(TextSelection.create(view.state.doc, expanded.from, expanded.to)),
				);
				return false;
			},
		},
	});
