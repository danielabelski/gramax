import type Context from "@core/Context/Context";
import type { ArticlePageOptions } from "./ArticlePage";

type BaseParams = {
	ctx: Context;
	path: string;
};

export type HomePageDataParams = BaseParams;
export type NotFoundCatalogParams = BaseParams;
export type ArticlePageDataParams = BaseParams & {
	options?: ArticlePageOptions;
	/** The address the reader asked for; `path` names the item and is a logic path in the editor. */
	pathname?: string;
};

export type PageDataParams = HomePageDataParams & ArticlePageDataParams & NotFoundCatalogParams;
