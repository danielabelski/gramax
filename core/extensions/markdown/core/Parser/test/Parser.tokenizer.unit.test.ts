import type { Schemes } from "@ext/markdown/core/Parser/Parser";
import MarkdownParser from "@ext/markdown/core/Parser/Parser";
import type { Token } from "@ext/markdown/core/render/logic/Markdoc";

describe("MarkdownParser tokenizer cache", () => {
	test("rebuilds the tokenizer when the available tag set changes", () => {
		const parser = new MarkdownParser();
		type TokenizerLike = { tokenize: (content: string) => Token[] };
		const getTokenizer = (tags?: Schemes["tags"]) =>
			// biome-ignore lint/style/useNamingConvention: accesses a private method to verify its cache
			(parser as unknown as { _getTokenizer: (tags?: Schemes["tags"]) => TokenizerLike })._getTokenizer(tags);
		const firstTags = { first: { selfClosing: true } } as Schemes["tags"];
		const secondTags = { second: { selfClosing: true } } as Schemes["tags"];

		const withoutContext = getTokenizer();
		const withFirstContext = getTokenizer(firstTags);
		const withSameContext = getTokenizer(firstTags);
		const withSecondContext = getTokenizer(secondTags);

		expect(withFirstContext).not.toBe(withoutContext);
		expect(withSameContext).toBe(withFirstContext);
		expect(withSecondContext).not.toBe(withFirstContext);
		expect(hasToken(withFirstContext.tokenize("{% first /%}"), "tag")).toBe(true);
		expect(hasToken(withSecondContext.tokenize("{% second /%}"), "tag")).toBe(true);
	});
});

function hasToken(tokens: Token[], type: string): boolean {
	return tokens.some((token) => token.type === type || (token.children && hasToken(token.children, type)));
}
