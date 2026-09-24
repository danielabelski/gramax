import SimpleMarkdownParser from "@ext/markdown/core/Parser/SimpleMarkdownParser";
import type { RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import chatCitations from "@ext/serach/utils/chatCitations/chatCitations";
import type { RowSearchResult } from "@ext/serach/utils/SearchRowsModel";

export type SearchData = { kind: "search"; rows: RowSearchResult[] } | { kind: "chat"; nodes: RenderableTreeNodes };

export type SearchStatus = "help" | "loading" | "empty" | "results" | "error";

const parser = new SimpleMarkdownParser();

export const parseChatResponse = async (buffer: string): Promise<RenderableTreeNodes> =>
	chatCitations(await parser.parse(buffer));

export const getSearchStatus = (emptyInput: boolean, data: SearchData | null, error?: unknown): SearchStatus => {
	if (error) return "error";
	if (!data) return emptyInput ? "help" : "loading";
	if (data.kind === "search" && data.rows.length === 0) return "empty";
	return "results";
};
