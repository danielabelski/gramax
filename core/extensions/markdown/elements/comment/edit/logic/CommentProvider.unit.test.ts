import { createEventEmitter } from "@core/Event/EventEmitter";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type CatalogEvents from "@core/FileStructue/Catalog/CatalogEvents";
import type FileStructure from "@core/FileStructue/FileStructure";
import type { CommentBlock } from "@core-ui/CommentBlock";
import type ParserContext from "@ext/markdown/core/Parser/ParserContext/ParserContext";
import * as yaml from "js-yaml";
import CommentProvider from "./CommentProvider";

jest.mock("@ext/markdown/core/Parser/ParserContext/PrivateParserContext", () => ({
	createPrivateParserContext: (context: unknown) => context,
}));

const articlePath = new Path("board/prd/article.md");

const storedComment = (content: string): CommentBlock<string> => ({
	comment: { dateTime: "2026-09-23T16:19:32.675Z", user: { mail: "a@example.com", name: "A" }, content },
	answers: [],
});

const createProvider = (initialFile: Record<string, CommentBlock<string>>) => {
	let file = yaml.dump(initialFile);
	const fp = {
		exists: jest.fn(async () => true),
		read: jest.fn(async () => file),
		write: jest.fn(async (_path: Path, content: string) => {
			file = content;
		}),
	} as unknown as FileProvider;
	const catalog = { events: createEventEmitter<CatalogEvents>() } as unknown as Catalog;
	const provider = new CommentProvider(fp, {} as FileStructure, catalog, false);
	const context = {
		parser: { editParse: async (content: string) => ({ content: [{ type: "text", text: content }] }) },
		formatter: { render: async (doc: { content: { text: string }[][] }) => doc.content[0][0].text },
	} as unknown as ParserContext;

	return { provider, context, readFile: () => yaml.load(file) as Record<string, CommentBlock<string>> };
};

describe("CommentProvider.saveComment", () => {
	test("keeps comments stored on disk when the provider has not loaded the article yet", async () => {
		const { provider, context, readFile } = createProvider({
			first: storedComment("first"),
			edited: storedComment("before edit"),
		});

		await provider.saveComment(
			"edited",
			{
				comment: {
					dateTime: "2026-09-23T16:19:32.675Z",
					user: { mail: "a@example.com", name: "A" },
					content: [{ type: "text", text: "after edit" }],
				},
				answers: [],
			},
			articlePath,
			context,
		);

		const saved = readFile();
		expect(Object.keys(saved).sort()).toEqual(["edited", "first"]);
		expect(saved.first.comment.content).toBe("first");
		expect(saved.edited.comment.content).toBe("after edit");
	});
});
