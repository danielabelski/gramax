import * as schemaModule from "@ext/markdown/core/edit/logic/Prosemirror/schema";
import MarkdownParser from "@ext/markdown/core/Parser/Parser";
import getTagElementRenderModels from "@ext/markdown/core/render/logic/getRenderElements/getTagElementRenderModels";
import type { Schema, Tokenizer } from "@ext/markdown/core/render/logic/Markdoc";
import * as pluginStore from "@plugins/store";

describe("MarkdownParser schema", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("reuses one schema while the plugin signature is unchanged", async () => {
		jest.spyOn(pluginStore, "getPluginParseSignature").mockReturnValue("same-plugins");
		const getSchema = jest.spyOn(schemaModule, "getSchema");
		const parser = new MarkdownParser();

		await parser.parse("First article");
		await parser.parse("Second article");

		expect(getSchema).toHaveBeenCalledTimes(1);
	});

	test("rebuilds the schema after the plugin signature changes", async () => {
		const getPluginParseSignature = jest
			.spyOn(pluginStore, "getPluginParseSignature")
			.mockReturnValueOnce("plugins-v1")
			.mockReturnValue("plugins-v2");
		const getSchema = jest.spyOn(schemaModule, "getSchema");
		const parser = new MarkdownParser();

		await parser.parse("First article");
		await parser.parse("Second article");

		expect(getPluginParseSignature).toHaveBeenCalledTimes(4);
		expect(getSchema).toHaveBeenCalledTimes(2);
	});

	test("reuses the parse tokenizer while the plugin signature is unchanged", () => {
		jest.spyOn(pluginStore, "getPluginParseSignature").mockReturnValue("same-plugins");
		const parser = new MarkdownParser();
		const tags = getTagElementRenderModels();

		const first = getTokenizer(parser, tags);
		const second = getTokenizer(parser, tags);

		expect(second).toBe(first);
	});

	test("rebuilds the parse tokenizer after the plugin signature changes", () => {
		jest.spyOn(pluginStore, "getPluginParseSignature")
			.mockReturnValueOnce("plugins-v1")
			.mockReturnValue("plugins-v2");
		const parser = new MarkdownParser();
		const tags = getTagElementRenderModels();

		const first = getTokenizer(parser, tags);
		const second = getTokenizer(parser, tags);

		expect(second).not.toBe(first);
	});

	test("constructs only one tokenizer during a parse", async () => {
		jest.spyOn(pluginStore, "getPluginParseSignature").mockReturnValue("same-plugins");
		const parser = new MarkdownParser();
		const getTokenizer = jest.spyOn(parser as never, "_getTokenizer");

		await parser.parse("Article");

		expect(getTokenizer).toHaveBeenCalledTimes(1);
	});
});

function getTokenizer(parser: MarkdownParser, tags: Record<string, Schema>): Tokenizer {
	const factory = Reflect.get(parser, "_getTokenizer") as (tags: Record<string, Schema>) => Tokenizer;
	return factory.call(parser, tags);
}
