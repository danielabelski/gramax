import type PrivateParserContext from "@ext/markdown/core/Parser/ParserContext/PrivateParserContext";
import blockCommentTransformer from "@ext/markdown/elements/comment/edit/logic/blockCommentTransformer";
import htmlTransform from "@ext/markdown/elements/html/edit/logic/htmlTransform";
import htmlTagTransform from "@ext/markdown/elements/htmlTag/logic/htmlTagTransform";
import imageTransform from "@ext/markdown/elements/image/edit/logic/imageTransform";
import tableTransform from "@ext/markdown/elements/table/logic/tableTransform";
import type { Token } from "../../render/logic/Markdoc";
import type MarkdownParser from "../Parser";
import type { ParseSchedule } from "../ParseScheduler";

type PreTransformerFuncProps = {
	tokens: Token[];
	context?: PrivateParserContext;
};

export type PreTransformerFunc = (props: PreTransformerFuncProps) => Token[];
export type MaybeAsyncPreTransformerFunc = (props: PreTransformerFuncProps) => Token[] | Promise<Token[]>;

const preTransformTokens = async ({
	tokens,
	context,
	parser,
	scheduler,
}: PreTransformerFuncProps & { parser: MarkdownParser; scheduler?: ParseSchedule }) => {
	const transformers: MaybeAsyncPreTransformerFunc[] = [
		tableTransform,
		imageTransform,
		htmlTagTransform,
		htmlTransform,
		blockCommentTransformer,
	];

	await parser.events.emit("get-pre-transformers", {
		mutable: { preTransformers: transformers },
		context,
	});

	const syntax = getTokenSyntax(tokens);
	const syntaxYield = scheduler?.();
	if (syntaxYield) await syntaxYield;
	let result = tokens;
	for (const transformer of transformers) {
		if (
			(transformer === tableTransform && !syntax.table) ||
			(transformer === imageTransform && !syntax.image) ||
			(transformer === htmlTagTransform && !syntax.blockHtmlTag) ||
			(transformer === htmlTransform && !syntax.html) ||
			(transformer === blockCommentTransformer && !syntax.blockComment)
		)
			continue;

		const transformed = transformer({ tokens: result, context });
		result = transformed instanceof Promise ? await transformed : transformed;
		const transformerYield = scheduler?.();
		if (transformerYield) await transformerYield;
	}
	return result;
};

function getTokenSyntax(tokens: Token[]) {
	const syntax = {
		table: false,
		image: false,
		blockHtmlTag: false,
		html: false,
		blockComment: false,
	};
	const visit = (items: Token[]) => {
		for (const token of items) {
			const tag = token.meta?.tag;
			if (tag === "table" || token.type === "table_open" || token.type === "td_open" || token.type === "th_open")
				syntax.table = true;
			if (token.tag === "img") syntax.image = true;
			if (tag === "blockHtmlTag" || tag === "blockWithInlineHtmlTag") syntax.blockHtmlTag = true;
			if (tag === "html") syntax.html = true;
			if (tag === "comment" && token.type === "tag_open") syntax.blockComment = true;
			if (token.children) visit(token.children);
		}
	};
	visit(tokens);
	return syntax;
}

export default preTransformTokens;
