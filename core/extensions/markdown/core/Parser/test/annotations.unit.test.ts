import { Tokenizer } from "@ext/markdown/core/render/logic/Markdoc";

describe("annotations tokenizer", () => {
	test.each([
		["{% tag /%}", "tag"],
		["<kbd>", "tag_open"],
	])("recognizes %s as a tag", (source, expectedType) => {
		const tokens = new Tokenizer({ linkify: false }).tokenize(source);

		expect(tokens.some((token) => token.type === expectedType)).toBe(true);
	});

	test.each(["<<<<<<< HEAD", "{"])("does not recognize %s as a tag", (source) => {
		const tokens = new Tokenizer({ linkify: false }).tokenize(source);

		expect(tokens.some((token) => token.type === "tag" || token.type === "tag_open")).toBe(false);
	});
});
