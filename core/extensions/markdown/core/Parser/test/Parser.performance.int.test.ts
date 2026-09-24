import MarkdownFormatter from "@ext/markdown/core/edit/logic/Formatter/Formatter";
import { getSchema, ProsemirrorMarkdownParser } from "@ext/markdown/core/edit/logic/Prosemirror";
import type NodeTransformerFunc from "@ext/markdown/core/edit/logic/Prosemirror/NodeTransformerFunc";
import type TokenTransformerFunc from "@ext/markdown/core/edit/logic/Prosemirror/TokenTransformerFunc";
import { getTokens } from "@ext/markdown/core/edit/logic/Prosemirror/tokens";
import { Transformer } from "@ext/markdown/core/edit/logic/Prosemirror/transformer";
import editTreeToRenderTree from "@ext/markdown/core/Parser/EditTreeToRenderTree";
import MdParser from "@ext/markdown/core/Parser/MdParser/MdParser";
import type PrivateParserContext from "@ext/markdown/core/Parser/ParserContext/PrivateParserContext";
import { createPrivateParserContext } from "@ext/markdown/core/Parser/ParserContext/PrivateParserContext";
import preTransformTokens from "@ext/markdown/core/Parser/Transformer/preTransformTokens";
import getNodeElementRenderModels from "@ext/markdown/core/render/logic/getRenderElements/getNodeElementRenderModels";
import getTagElementRenderModels from "@ext/markdown/core/render/logic/getRenderElements/getTagElementRenderModels";
import { type Schema, Tokenizer } from "@ext/markdown/core/render/logic/Markdoc";
import quizTokensTransformer from "@ext/markdown/elements/answer/edit/logic/quizTokensTransformer";
import commentTokenTransformer from "@ext/markdown/elements/comment/logic/commentTokenTransformer";
import cutTokenTransformer from "@ext/markdown/elements/cut/logic/cutTokenTransformer";
import htmlTokenTransformer from "@ext/markdown/elements/html/logic/htmlTokenTransformer";
import htmlTagTokenTransformer from "@ext/markdown/elements/htmlTag/logic/htmlTagTokenTransformer";
import iconTokenTransformer from "@ext/markdown/elements/icon/logic/iconTokenTransformer";
import imageTokenTransformer from "@ext/markdown/elements/image/logic/imageTokenTransformer";
import inlineImageTokenTransformer from "@ext/markdown/elements/inlineImage/edit/logic/inlineImageTokenTransformer";
import inlinePropertyTokenTransformer from "@ext/markdown/elements/inlineProperty/edit/logic/inlinePropertyTokenTransformer";
import tableTokenTransformer from "@ext/markdown/elements/table/logic/tableTokenTransformer";
import type { JSONContent } from "@tiptap/core";
import testData from "./EditTreeToRenderTreeTestData.json";
import { getParserTestData } from "./getParserTestData";

jest.mock("react", () => ({
	...jest.requireActual("react"),
	useLayoutEffect: jest.requireActual("react").useEffect,
}));

jest.mock("next/router", () => ({
	useRouter: jest.fn(),
}));

const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;
const EDIT_TREE_TO_RENDER_TREE_BUDGET_MS = 100;
const FULL_PARSE_BUDGET_MS = 1_000;
const GET_HTML_BUDGET_MS = 1_000;
const TRANSFORM_TREE_BUDGET_MS = 500;
const TRANSFORM_TOKEN_BUDGET_MS = 500;
const TRANSFORM_TOKEN_REPEATS = 100;
const QUIZ_ANSWER_COUNT = 1_000;
const QUIZ_TRANSFORM_BUDGET_MS = 500;
const SYNTHETIC_TOKEN_COUNT = 5_000;
const SYNTHETIC_TRANSFORM_BUDGET_MS = 500;
const LINK_COUNT = 1_000;
const LINK_HEAVY_PARSE_BUDGET_MS = 2_000;
const FROM_MARKDOWN_BUDGET_MS = 500;
const FROM_MARKDOWN_TOKEN_COUNT = 5_000;
const PREPARSE_PARAGRAPH_COUNT = 5_000;
const PREPARSE_BUDGET_MS = 500;
const TOKENIZE_BUDGET_MS = 500;
const MD_COMPONENT_NODE_COUNT = 5_000;
const MD_COMPONENT_TRANSFORM_BUDGET_MS = 500;
const PRE_TRANSFORM_BUDGET_MS = 500;

interface BenchmarkResult {
	medianMs: number;
	p95Ms: number;
}

const editTree = testData.editTree as JSONContent;

describe("MarkdownParser performance", () => {
	jest.setTimeout(120_000);

	let markdown: string;
	let parserData: Awaited<ReturnType<typeof getParserTestData>>;
	let privateContext: PrivateParserContext;
	let tokens: Awaited<ReturnType<typeof preTransformTokens>>;
	let tokenTransformer: Transformer;
	let schemes: Record<string, Schema>;

	beforeAll(async () => {
		const formatter = new MarkdownFormatter();
		markdown = await formatter.render(structuredClone(editTree));
		parserData = await getParserTestData();
		privateContext = createPrivateParserContext(parserData.parseContext);
		const tags = getTagElementRenderModels(privateContext);
		const nodes = getNodeElementRenderModels(privateContext);
		schemes = { ...tags, ...nodes };
		const tokenizer = new Tokenizer({ linkify: false }, tags);
		const rawTokens = tokenizer.tokenize(new MdParser({ tags }).preParse(markdown));
		tokens = await preTransformTokens({ tokens: rawTokens, context: privateContext, parser: parserData.parser });
		const tokenTransformers: TokenTransformerFunc[] = [
			inlineImageTokenTransformer,
			inlinePropertyTokenTransformer,
			htmlTokenTransformer,
			tableTokenTransformer,
			cutTokenTransformer,
			imageTokenTransformer,
			commentTokenTransformer,
			iconTokenTransformer,
			htmlTagTokenTransformer,
			quizTokensTransformer,
		];
		tokenTransformer = new Transformer(schemes, [], tokenTransformers, privateContext, getSchema());
	});

	test("converts a long edit tree within the regression budget", () => {
		const trees = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => structuredClone(editTree));
		let treeIndex = 0;
		const result = benchmarkSync(() => {
			editTreeToRenderTree(trees[treeIndex++], getSchema());
		});

		writeResult("edit-tree-to-render-tree", result);
		expect(result.p95Ms).toBeLessThan(EDIT_TREE_TO_RENDER_TREE_BUDGET_MS);
	});

	test("parses a long article within the regression budget", async () => {
		const result = await benchmarkAsync(async () => {
			await parserData.parser.parse(markdown, parserData.parseContext, "requestURL.com");
		});

		writeResult("full-parse", result);
		expect(result.p95Ms).toBeLessThan(FULL_PARSE_BUDGET_MS);
	});

	test("parses an article with many distinct links within the regression budget", async () => {
		const linkHeavyMarkdown = Array.from(
			{ length: LINK_COUNT },
			(_, index) => `[Missing article ${index}](./missing-article-${index})`,
		).join("\n\n");
		const result = await benchmarkAsync(async () => {
			await parserData.parser.parse(linkHeavyMarkdown, parserData.parseContext, "requestURL.com");
		});

		writeResult("full-parse-many-links", result);
		expect(result.p95Ms).toBeLessThan(LINK_HEAVY_PARSE_BUDGET_MS);
	});

	test("preparses a large plain Markdown document within the regression budget", () => {
		const plainMarkdown = Array.from(
			{ length: PREPARSE_PARAGRAPH_COUNT },
			(_, index) => `Plain paragraph ${index} without custom syntax.`,
		).join("\n\n");
		const tags = getTagElementRenderModels(privateContext);
		const result = benchmarkSync(() => {
			new MdParser({ tags }).preParse(plainMarkdown);
		});

		writeResult("get-tokens-preparse", result);
		expect(result.p95Ms).toBeLessThan(PREPARSE_BUDGET_MS);
	});

	test("preparses Markdown with many links within the regression budget", () => {
		const linkMarkdown = Array.from(
			{ length: PREPARSE_PARAGRAPH_COUNT },
			(_, index) => `[Article ${index}](./article-${index}.md)`,
		).join("\n\n");
		const tags = getTagElementRenderModels(privateContext);
		const result = benchmarkSync(() => {
			new MdParser({ tags }).preParse(linkMarkdown);
		});

		writeResult("get-tokens-preparse-many-links", result);
		expect(result.p95Ms).toBeLessThan(PREPARSE_BUDGET_MS);
	});

	test("tokenizes a large plain Markdown document within the regression budget", () => {
		const plainMarkdown = Array.from(
			{ length: PREPARSE_PARAGRAPH_COUNT },
			(_, index) => `Plain paragraph ${index} without custom syntax.`,
		).join("\n\n");
		const tokenizer = new Tokenizer({ linkify: false }, getTagElementRenderModels(privateContext));
		const result = benchmarkSync(() => {
			tokenizer.tokenize(plainMarkdown);
		});

		writeResult("get-tokens-tokenize", result);
		expect(result.p95Ms).toBeLessThan(TOKENIZE_BUDGET_MS);
	});

	test("tokenizes Markdown with many links within the regression budget", () => {
		const linkMarkdown = Array.from(
			{ length: PREPARSE_PARAGRAPH_COUNT },
			(_, index) => `[Article ${index}](./article-${index}.md)`,
		).join("\n\n");
		const tokenizer = new Tokenizer({ linkify: false }, getTagElementRenderModels(privateContext));
		const result = benchmarkSync(() => {
			tokenizer.tokenize(linkMarkdown);
		});

		writeResult("get-tokens-tokenize-many-links", result);
		expect(result.p95Ms).toBeLessThan(TOKENIZE_BUDGET_MS);
	});

	test("transforms a long edit tree within the regression budget", async () => {
		const noOpTransformer: NodeTransformerFunc = async (node) => ({ isSet: false, value: node });
		const transformer = new Transformer({}, [noOpTransformer], [], undefined as PrivateParserContext, getSchema());
		const trees = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => structuredClone(editTree));
		let treeIndex = 0;
		const result = await benchmarkAsync(async () => {
			await transformer.transformTree(trees[treeIndex++], null, null, 0);
		});

		writeResult("transform-tree", result);
		expect(result.p95Ms).toBeLessThan(TRANSFORM_TREE_BUDGET_MS);
	});

	test("walks a large tree without Markdown components within the regression budget", async () => {
		const transformer = new Transformer({}, [], [], privateContext, getSchema());
		const trees = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => createPlainEditTree());
		let treeIndex = 0;
		const result = await benchmarkAsync(async () => {
			await transformer.transformMdComponents(trees[treeIndex++], async () => []);
		});

		writeResult("transform-md-components-plain", result);
		expect(result.p95Ms).toBeLessThan(MD_COMPONENT_TRANSFORM_BUDGET_MS);
	});

	test("renders many Markdown components within the regression budget", async () => {
		const transformer = new Transformer({}, [], [], privateContext, getSchema());
		const trees = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => createMdComponentEditTree());
		let treeIndex = 0;
		const result = await benchmarkAsync(async () => {
			await transformer.transformMdComponents(trees[treeIndex++], async (content) => content);
		});

		writeResult("transform-md-components-many", result);
		expect(result.p95Ms).toBeLessThan(MD_COMPONENT_TRANSFORM_BUDGET_MS);
	});

	test("transforms tokens from a long article within the regression budget", () => {
		const tokenSets = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () =>
			Array.from({ length: TRANSFORM_TOKEN_REPEATS }, () => structuredClone(tokens)),
		);
		let tokenSetIndex = 0;
		const result = benchmarkSync(() => {
			for (const tokenSet of tokenSets[tokenSetIndex++]) tokenTransformer.transformToken(tokenSet);
		});

		writeResult("transform-token", result);
		expect(result.p95Ms).toBeLessThan(TRANSFORM_TOKEN_BUDGET_MS);
	});

	test("pretransforms many plain tokens within the regression budget", async () => {
		const tokenSets = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => createNestedTextTokens());
		let tokenSetIndex = 0;
		const result = await benchmarkAsync(async () => {
			await preTransformTokens({
				tokens: tokenSets[tokenSetIndex++] as never,
				context: privateContext,
				parser: parserData.parser,
			});
		});

		writeResult("pre-transform-tokens-plain", result);
		expect(result.p95Ms).toBeLessThan(PRE_TRANSFORM_BUDGET_MS);
	});

	test("builds a ProseMirror tree from long-article tokens within the regression budget", async () => {
		const parser = new ProsemirrorMarkdownParser(getSchema(), undefined, getTokens(privateContext));
		const tags = getTagElementRenderModels(privateContext);
		const tokenizer = new Tokenizer({ linkify: false }, tags);
		const preparedMarkdown = new MdParser({ tags }).preParse(markdown);
		const tokenSets = await Promise.all(
			Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, async () => {
				const rawTokens = tokenizer.tokenize(preparedMarkdown);
				const preparedTokens = await preTransformTokens({
					tokens: rawTokens,
					context: privateContext,
					parser: parserData.parser,
				});
				return tokenTransformer.transformToken(preparedTokens);
			}),
		);
		let tokenSetIndex = 0;
		const result = await benchmarkAsync(async () => {
			await parser.parse(tokenSets[tokenSetIndex++]);
		});

		writeResult("from-markdown", result);
		expect(result.p95Ms).toBeLessThan(FROM_MARKDOWN_BUDGET_MS);
	});

	test("builds a ProseMirror tree from many synchronous tokens within the regression budget", async () => {
		const parser = new ProsemirrorMarkdownParser(getSchema(), undefined, getTokens(privateContext));
		const tokenSets = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () =>
			createParagraphTokens(FROM_MARKDOWN_TOKEN_COUNT),
		);
		let tokenSetIndex = 0;
		const result = await benchmarkAsync(async () => {
			await parser.parse(tokenSets[tokenSetIndex++]);
		});

		writeResult("from-markdown-many-sync-tokens", result);
		expect(result.p95Ms).toBeLessThan(FROM_MARKDOWN_BUDGET_MS);
	});

	test("transforms a quiz with many answers within the regression budget", () => {
		const transformer = new Transformer({}, [], [quizTokensTransformer], privateContext, getSchema());
		const tokenSets = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => createQuizTokens());
		let tokenSetIndex = 0;
		const result = benchmarkSync(() => {
			transformer.transformToken(tokenSets[tokenSetIndex++]);
		});

		writeResult("transform-quiz", result);
		expect(result.p95Ms).toBeLessThan(QUIZ_TRANSFORM_BUDGET_MS);
	});

	test("transforms many nested text tokens within the regression budget", () => {
		const noOpTransformer: TokenTransformerFunc = () => undefined;
		const transformer = new Transformer({}, [], [noOpTransformer], privateContext, getSchema());
		const tokenSets = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => createNestedTextTokens());
		let tokenSetIndex = 0;
		const result = benchmarkSync(() => {
			transformer.transformToken(tokenSets[tokenSetIndex++]);
		});

		writeResult("transform-nested-text", result);
		expect(result.p95Ms).toBeLessThan(SYNTHETIC_TRANSFORM_BUDGET_MS);
	});

	test("transforms many links and custom tags within the regression budget", () => {
		const transformer = new Transformer(schemes, [], [], privateContext, getSchema());
		const tokenSets = Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, () => createLinkAndTagTokens());
		let tokenSetIndex = 0;
		const result = benchmarkSync(() => {
			transformer.transformToken(tokenSets[tokenSetIndex++]);
		});

		writeResult("transform-links-and-tags", result);
		expect(result.p95Ms).toBeLessThan(SYNTHETIC_TRANSFORM_BUDGET_MS);
	});

	test("renders HTML from a parsed long article within the regression budget", async () => {
		const parsed = await parserData.parser.parse(markdown, parserData.parseContext, "requestURL.com");
		const result = benchmarkSync(() => {
			parserData.parser.getHtml(parsed.renderTree, parserData.parseContext, "requestURL.com");
		});

		writeResult("get-html", result);
		expect(result.p95Ms).toBeLessThan(GET_HTML_BUDGET_MS);
	});
});

function createQuizTokens(): Array<Record<string, unknown>> {
	const answers = Array.from({ length: QUIZ_ANSWER_COUNT }, (_, index) => [
		{ type: "questionAnswer_open", attrs: { correct: index === 0 ? "true" : "false" } },
		{ type: "paragraph_open" },
		{ type: "text", content: `Answer ${index}` },
		{ type: "paragraph_close" },
		{ type: "questionAnswer_close" },
	]).flat();

	return [
		{ type: "question_open", attrs: { id: "question", type: "one" } },
		{ type: "paragraph_open" },
		{ type: "text", content: "Question" },
		{ type: "paragraph_close" },
		...answers,
		{ type: "question_close" },
	];
}

function createNestedTextTokens(): Array<Record<string, unknown>> {
	return [
		{
			type: "inline",
			children: Array.from({ length: SYNTHETIC_TOKEN_COUNT }, (_, index) => ({
				type: "text",
				content: `Text ${index}`,
			})),
		},
	];
}

function createLinkAndTagTokens(): Array<Record<string, unknown>> {
	return Array.from({ length: SYNTHETIC_TOKEN_COUNT / 5 }, (_, index) => [
		{ type: "link_open", attrs: { href: `/article-${index}` } },
		{ type: "text", content: `Article ${index}` },
		{ type: "link_close" },
		{ type: "variable", info: `value.${index}` },
		{ type: "tag", meta: { tag: "snippet-link", attributes: [] } },
	]).flat();
}

function createParagraphTokens(count: number): Array<Record<string, unknown>> {
	return Array.from({ length: count }, (_, index) => [
		{ type: "paragraph_open" },
		{ type: "text", content: `Text ${index}` },
		{ type: "paragraph_close" },
	]).flat();
}

function createPlainEditTree(): JSONContent {
	return {
		type: "doc",
		content: Array.from({ length: MD_COMPONENT_NODE_COUNT }, (_, index) => ({
			type: "paragraph",
			content: [{ type: "text", text: `Text ${index}` }],
		})),
	};
}

function createMdComponentEditTree(): JSONContent {
	return {
		type: "doc",
		content: Array.from({ length: MD_COMPONENT_NODE_COUNT }, (_, index) => ({
			type: "text",
			text: `Inline ${index}`,
			marks: [{ type: "inlineMd" }],
		})),
	};
}

function benchmarkSync(run: () => void): BenchmarkResult {
	for (let i = 0; i < WARMUP_RUNS; i++) run();

	const samples = Array.from({ length: MEASURED_RUNS }, () => {
		const start = performance.now();
		run();
		return performance.now() - start;
	});

	return summarize(samples);
}

async function benchmarkAsync(run: () => Promise<void>): Promise<BenchmarkResult> {
	for (let i = 0; i < WARMUP_RUNS; i++) await run();

	const samples: number[] = [];
	for (let i = 0; i < MEASURED_RUNS; i++) {
		const start = performance.now();
		await run();
		samples.push(performance.now() - start);
	}

	return summarize(samples);
}

function summarize(samples: number[]): BenchmarkResult {
	const sorted = [...samples].sort((a, b) => a - b);
	return {
		medianMs: percentile(sorted, 0.5),
		p95Ms: percentile(sorted, 0.95),
	};
}

function percentile(sortedSamples: number[], percentileValue: number): number {
	const index = Math.ceil(sortedSamples.length * percentileValue) - 1;
	return sortedSamples[Math.max(0, index)];
}

function writeResult(name: string, result: BenchmarkResult): void {
	process.stdout.write(
		`[parser-performance] ${name}: median=${result.medianMs.toFixed(2)}ms p95=${result.p95Ms.toFixed(2)}ms\n`,
	);
}
