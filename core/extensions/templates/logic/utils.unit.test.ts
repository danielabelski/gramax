import type { PropertyValue } from "@ext/properties/models";
import { fillMarkdownTemplate } from "@ext/templates/logic/utils";

const TABLE = "|   |   |\n|---|---|\n|   |   |";

describe("fillMarkdownTemplate", () => {
	it("puts the property value between the block tags as it was written", () => {
		const template = "text\n\n[block-property:HHkTb]\n\n[/block-property]\n";
		const properties: PropertyValue[] = [{ id: "HHkTb", value: [TABLE] }];

		expect(fillMarkdownTemplate(null, properties, template)).toBe(
			`text\n\n[block-property:HHkTb]\n${TABLE}\n[/block-property]\n`,
		);
	});

	// gh#937: `^\s*` captured the line break in front of the tag, so every content line got a
	// stray one — a table inside the block came back as separate paragraphs of raw markdown.
	it("does not put a blank line between the lines of the value", () => {
		const template = "text\n\n[block-property:HHkTb]\n\n[/block-property]\n";
		const properties: PropertyValue[] = [{ id: "HHkTb", value: [TABLE] }];

		expect(fillMarkdownTemplate(null, properties, template)).not.toContain("|\n\n|");
	});

	it("keeps the indentation of an indented block", () => {
		const template = "-  item\n\n   [block-property:HHkTb]\n\n   [/block-property]\n";
		const properties: PropertyValue[] = [{ id: "HHkTb", value: ["first\n\nsecond"] }];

		expect(fillMarkdownTemplate(null, properties, template)).toBe(
			"-  item\n\n   [block-property:HHkTb]\n   first\n\n   second\n   [/block-property]\n",
		);
	});

	it("leaves the template alone when the property has no value", () => {
		const template = "[block-property:HHkTb]\n\n[/block-property]\n";

		expect(fillMarkdownTemplate(null, [{ id: "HHkTb", value: [""] }], template)).toBe(template);
		expect(fillMarkdownTemplate(null, null, template)).toBe(template);
	});

	it("fills template fields", () => {
		const template = "[block-field:name:placeholder]\n[/block-field]\n";

		expect(fillMarkdownTemplate([{ name: "name", value: "value" }], null, template)).toBe(
			"[block-field:name:placeholder]\nvalue\n[/block-field]\n",
		);
	});
});
