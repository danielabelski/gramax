import { MarkdownParser, type ParseSpec } from "@ext/markdown/core/edit/logic/Prosemirror/from_markdown";
import { getSchema } from "@ext/markdown/core/edit/logic/Prosemirror/schema";

describe("ProseMirror MarkdownParser", () => {
	test("parses tokens with synchronous attributes", async () => {
		const parser = createParser({ heading: { block: "heading", getAttrs: () => ({ level: 2 }) } });

		const document = await parser.parse([
			{ type: "heading_open" },
			{ type: "text", content: "Text" },
			{ type: "heading_close" },
		]);

		expect(document.toJSON()).toMatchObject({
			content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Text" }] }],
		});
	});

	test("waits for asynchronous attributes", async () => {
		const parser = createParser({
			heading: {
				block: "heading",
				getAttrs: async () => {
					await Promise.resolve();
					return { level: 3 };
				},
			},
		});

		const document = await parser.parse([
			{ type: "heading_open" },
			{ type: "text", content: "Text" },
			{ type: "heading_close" },
		]);

		expect(document.toJSON()).toMatchObject({
			content: [{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Text" }] }],
		});
	});
});

function createParser(tokens: Record<string, ParseSpec>): MarkdownParser {
	return new MarkdownParser(getSchema(), undefined, tokens);
}
