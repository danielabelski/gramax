import { getParserTestData } from "@ext/markdown/core/Parser/test/getParserTestData";
import type { PropertyValue } from "@ext/properties/models";
import { fillMarkdownTemplate } from "@ext/templates/logic/utils";

const TEMPLATE = "text\n\n[block-property:HHkTb]\n\n[/block-property]\n";

const findNode = (node: { type?: string; content?: unknown[] }, type: string): boolean =>
	node?.type === type ||
	((node?.content ?? []) as { type?: string; content?: unknown[] }[]).some((child) => findNode(child, type));

describe("a filled template", () => {
	// gh#937: the value came back split by blank lines, so the table parsed as paragraphs of
	// raw markdown — that is what the article showed after a reload.
	it("parses a table stored in a block property as a table", async () => {
		const { parser, parseContext } = await getParserTestData();
		const properties: PropertyValue[] = [{ id: "HHkTb", value: ["| a | b |\n|---|---|\n| 1 | 2 |"] }];

		const content = await parser.parse(fillMarkdownTemplate(null, properties, TEMPLATE), parseContext);

		expect(findNode(content.editTree, "block-property")).toBe(true);
		expect(findNode(content.editTree, "table")).toBe(true);
		expect(JSON.stringify(content.editTree)).not.toContain("|---|");
	});
});
