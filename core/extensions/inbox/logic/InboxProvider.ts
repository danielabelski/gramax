import { INBOX_DIRECTORY } from "@app/config/const";
import type Context from "@core/Context/Context";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Article, ArticleProps } from "@core/FileStructue/Article/Article";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type FileStructure from "@core/FileStructue/FileStructure";
import AuthorInfoCodec from "@core-ui/utils/authorInfoCodec";
import ArticleProvider from "@ext/articleProvider/logic/ArticleProvider";
import type { InboxArticle, InboxProps } from "@ext/inbox/models/types";
import { convertContentToUiLanguage } from "@ext/localization/locale/translate";
import type MarkdownParser from "@ext/markdown/core/Parser/Parser";
import type ParserContextFactory from "@ext/markdown/core/Parser/ParserContext/ParserContextFactory";
import assert from "assert";

declare module "@ext/articleProvider/logic/ArticleProvider" {
	export enum ArticleProviders {
		inbox = "inbox",
	}
}

export default class InboxProvider extends ArticleProvider {
	constructor(fp: FileProvider, fs: FileStructure, catalog: Catalog) {
		super(fp, fs, catalog, new Path(INBOX_DIRECTORY));
	}

	public async mergeArticles(
		draggedId: string,
		droppedId: string,
		parser: MarkdownParser,
		parserContextFactory: ParserContextFactory,
		ctx: Context,
	): Promise<Article<ArticleProps>> {
		const draggedArticle = this.getArticle(draggedId);
		const droppedArticle = this.getArticle(droppedId);

		assert(draggedArticle, "Dragged article not found");
		assert(droppedArticle, "Dropped article not found");

		const newContent = `${await droppedArticle.getContent()}\n\n${await draggedArticle.getContent()}`;

		const context = await parserContextFactory.fromArticle(
			droppedArticle,
			this._catalog,
			convertContentToUiLanguage(ctx.contentLanguage || this._catalog.props.language),
		);

		await droppedArticle.updateContent(newContent);
		await droppedArticle.parsedContent.write(() => parser.parse(newContent, context));
		await this.remove(draggedArticle.ref.path.name, parser, parserContextFactory, ctx);

		return droppedArticle;
	}

	public async getInboxItems(
		filterUserMail: string,
		parser: MarkdownParser,
		parserContextFactory: ParserContextFactory,
		ctx: Context,
	): Promise<InboxArticle[]> {
		if (filterUserMail) await this.readArticles();
		const values = (await super.getItems(true)) as Article<InboxProps>[];
		const notes: InboxArticle[] = [];

		for (const item of values) {
			const props: InboxProps = item.props;
			const author = AuthorInfoCodec.deserialize(props.author);
			if (filterUserMail && author.email !== filterUserMail) continue;

			const editTree = await this.getEditTree(item.ref.path.name, parser, parserContextFactory, ctx);
			notes.push({ ...this._createItem<InboxArticle>(item), editTree });
		}

		return notes;
	}

	public async getInboxUsers(): Promise<string[]> {
		const items = await super.getItems<Article<InboxProps>>(true);
		const setOfUsers = new Set<string>();
		items.forEach((item) => {
			const author = AuthorInfoCodec.deserialize(item.props.author);
			setOfUsers.add(author?.email);
		});

		return Array.from(setOfUsers);
	}

	override _createItem<T = InboxArticle>(item: Article<InboxProps>): T {
		return {
			id: item.ref.path.name,
			title: item.props.title ?? "",
			editTree: { type: "doc", content: [{ type: "paragraph" }] },
			props: {
				date: item.props.date,
				author: item.props.author,
			},
		} as T;
	}
}
