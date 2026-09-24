import { getMarkdocFormatter } from "@ext/markdown/core/edit/logic/Formatter/Formatters/getMarkdocFormatter";
import type NodeTransformerFunc from "@ext/markdown/core/edit/logic/Prosemirror/NodeTransformerFunc";
import { getSchema } from "@ext/markdown/core/edit/logic/Prosemirror/schema";
import type TokenTransformerFunc from "@ext/markdown/core/edit/logic/Prosemirror/TokenTransformerFunc";
import { Transformer } from "@ext/markdown/core/edit/logic/Prosemirror/transformer";
import type PrivateParserContext from "@ext/markdown/core/Parser/ParserContext/PrivateParserContext";
import { SchemaType } from "@ext/markdown/core/render/logic/Markdoc";
import type { JSONContent } from "@tiptap/core";

jest.mock("@ext/markdown/core/edit/logic/Formatter/Formatters/getMarkdocFormatter", () => ({
	getMarkdocFormatter: jest.fn(() => () => "{% custom /%}"),
}));

const mockGetMarkdocFormatter = jest.mocked(getMarkdocFormatter);

const context = undefined as PrivateParserContext;

const createTransformer = (
	nodeTransformers: NodeTransformerFunc[] = [],
	tokenTransformers: TokenTransformerFunc[] = [],
) => new Transformer({}, nodeTransformers, tokenTransformers, context, getSchema());

describe("ProseMirror Transformer", () => {
	describe("transformToken", () => {
		test("creates an empty paragraph for an empty token list", () => {
			const transformer = createTransformer();

			expect(transformer.transformToken([])).toEqual([
				{ type: "paragraph_open", tag: "p" },
				{ type: "paragraph_close", tag: "p" },
			]);
		});

		test("runs custom transformers on both passes for unchanged simple tokens", () => {
			const calls: string[] = [];
			const customTransformer: TokenTransformerFunc = ({ token }) => {
				calls.push(token.type);
			};
			const transformer = createTransformer([], [customTransformer]);

			const result = transformer.transformToken([{ type: "text", content: "text" }]);

			expect(result).toEqual([{ type: "text", content: "text" }]);
			expect(calls).toEqual(["text", "text"]);
		});

		test("lets custom transformers observe neighbors changed by the first pass", () => {
			const customTransformer: TokenTransformerFunc = ({ token, previous }) => {
				if (token.type === "source") return { type: "generated" };
				if (token.type === "target" && previous?.type === "generated") return { type: "final" };
			};
			const transformer = createTransformer([], [customTransformer]);

			expect(transformer.transformToken([{ type: "source" }, { type: "target" }])).toEqual([
				{ type: "generated" },
				{ type: "final" },
			]);
		});

		test("runs the second pass for tokens produced by the first pass", () => {
			const customTransformer: TokenTransformerFunc = ({ token }) => {
				if (token.type === "source") return { type: "generated" };
				if (token.type === "generated") return { type: "final" };
			};
			const transformer = createTransformer([], [customTransformer]);

			expect(transformer.transformToken([{ type: "source" }])).toEqual([{ type: "final" }]);
		});

		test("transforms nested children and passes their parent", () => {
			const parents: Array<string | undefined> = [];
			const customTransformer: TokenTransformerFunc = ({ token, parent }) => {
				if (token.type === "child") parents.push(parent?.type);
			};
			const transformer = createTransformer([], [customTransformer]);

			transformer.transformToken([{ type: "inline", children: [{ type: "child" }] }]);

			expect(parents).toEqual(["inline", "inline"]);
		});

		test("does not accumulate built-in transformers between calls", () => {
			const customTransformer = jest.fn<ReturnType<TokenTransformerFunc>, Parameters<TokenTransformerFunc>>();
			const transformer = createTransformer([], [customTransformer]);
			const tokens = [{ type: "text", content: "text" }];

			const first = transformer.transformToken(structuredClone(tokens));
			const callsAfterFirstRun = customTransformer.mock.calls.length;
			const second = transformer.transformToken(structuredClone(tokens));

			expect(second).toEqual(first);
			expect(customTransformer.mock.calls.length).toBe(callsAfterFirstRun * 2);
		});

		test("does not mutate the provided custom transformer list", () => {
			const customTransformer: TokenTransformerFunc = () => undefined;
			const customTransformers = [customTransformer];
			const transformer = createTransformer([], customTransformers);

			transformer.transformToken([{ type: "text", content: "text" }]);

			expect(customTransformers).toEqual([customTransformer]);
		});

		test("converts variables and top-level annotations to inline Markdown tokens", () => {
			const transformer = createTransformer();

			const result = transformer.transformToken([
				{ type: "variable", info: "product.name" },
				{ type: "annotation", info: "#anchor" },
			]);

			expect(result).toEqual([
				{ type: "inlineMd_open", tag: "inlineMd" },
				{ type: "text", content: "{% product.name %}" },
				{ type: "inlineMd_close", tag: "inlineMd" },
				{ type: "inlineMd_open", tag: "inlineMd" },
				{ type: "text", content: "{#anchor}" },
				{ type: "inlineMd_close", tag: "inlineMd" },
			]);
		});

		test("creates a formatter once for repeated tags of the same type", () => {
			mockGetMarkdocFormatter.mockClear();
			const transformer = new Transformer({ custom: { type: SchemaType.inline } }, [], [], context, getSchema());

			transformer.transformToken([
				{ type: "tag", meta: { tag: "custom" } },
				{ type: "tag", meta: { tag: "custom" } },
			]);

			expect(mockGetMarkdocFormatter).toHaveBeenCalledTimes(1);
		});
	});

	describe("transformTree", () => {
		test("walks children bottom-up and provides sibling and count arguments", async () => {
			const calls: Array<{
				type: string;
				previous?: string;
				next?: string;
				count?: number;
			}> = [];
			const nodeTransformer: NodeTransformerFunc = (node, previous, next, _context, count) => {
				calls.push({ type: node.type, previous: previous?.type, next: next?.type, count });
				return { isSet: false, value: node };
			};
			const transformer = createTransformer([nodeTransformer]);
			const tree: JSONContent = {
				type: "doc",
				content: [{ type: "first" }, { type: "second", content: [{ type: "nested" }] }],
			};

			await transformer.transformTree(tree, null, null, 0);

			expect(calls).toEqual([
				{ type: "first", previous: undefined, next: "second", count: 1 },
				{ type: "nested", previous: undefined, next: undefined, count: 3 },
				{ type: "second", previous: "first", next: undefined, count: 2 },
				{ type: "doc", previous: undefined, next: undefined, count: 0 },
			]);
		});

		test("stops after the first transformer that sets a value", async () => {
			const firstFn: NodeTransformerFunc = (node) => ({ isSet: true, value: { ...node, type: "changed" } });
			const secondFn = jest.fn<ReturnType<NodeTransformerFunc>, Parameters<NodeTransformerFunc>>();
			const transformer = createTransformer([firstFn, secondFn]);

			const result = await transformer.transformTree({ type: "paragraph" }, null, null, 0);

			expect(result).toEqual({ type: "changed" });
			expect(secondFn).not.toHaveBeenCalled();
		});

		test("flattens replacement arrays and removes empty child results", async () => {
			const nodeTransformer: NodeTransformerFunc = (node) => {
				if (node.type === "expand")
					return { isSet: true, value: [{ type: "first" }, { type: "second" }] as unknown as JSONContent };
				if (node.type === "remove") return { isSet: true, value: null };
				return { isSet: false, value: node };
			};
			const transformer = createTransformer([nodeTransformer]);

			const result = await transformer.transformTree(
				{ type: "doc", content: [{ type: "expand" }, { type: "remove" }] },
				null,
				null,
				0,
			);

			expect(result.content).toEqual([{ type: "first" }, { type: "second" }]);
		});
	});

	describe("transformMdComponents", () => {
		test("renders inline and block Markdown components recursively", async () => {
			const renderCalls: Array<{ content: string; isBlock: boolean }> = [];
			const renderer = async (content: string, _context, options): Promise<string> => {
				renderCalls.push({ content, isBlock: options.isBlock });
				return `rendered-${content}`;
			};
			const transformer = createTransformer();
			const tree: JSONContent = {
				type: "doc",
				content: [
					{
						type: "text",
						text: "inline",
						marks: [{ type: "inlineMd" }, { type: "comment", attrs: { id: "1" } }],
					},
					{ type: "blockMd", attrs: { text: "block" } },
				],
			};

			const result = await transformer.transformMdComponents(tree, renderer);

			expect(result.content).toEqual([
				{
					type: "inlineMd_component",
					attrs: {
						comment: { id: "1" },
						tag: "rendered-inline",
						text: "inline",
					},
					marks: [],
				},
				{
					type: "blockMd",
					attrs: {
						text: "block",
						tag: "rendered-block",
					},
				},
			]);
			expect(renderCalls).toEqual([
				{ content: "inline", isBlock: false },
				{ content: "block", isBlock: true },
			]);
		});

		test("starts all component renders before waiting for their results", async () => {
			const resolvers: Array<() => void> = [];
			const renderer = jest.fn(
				(content: string) =>
					new Promise<string>((resolve) => resolvers.push(() => resolve(`rendered-${content}`))),
			);
			const transformer = createTransformer();
			const tree: JSONContent = {
				type: "doc",
				content: [
					{ type: "text", text: "first", marks: [{ type: "inlineMd" }] },
					{ type: "blockMd", attrs: { text: "second" } },
				],
			};

			const resultPromise = transformer.transformMdComponents(tree, renderer);
			expect(renderer).toHaveBeenCalledTimes(2);
			for (const resolve of resolvers) resolve();
			await expect(resultPromise).resolves.toMatchObject({
				content: [
					{ type: "inlineMd_component", attrs: { tag: "rendered-first" } },
					{ type: "blockMd", attrs: { tag: "rendered-second" } },
				],
			});
		});
	});
});
