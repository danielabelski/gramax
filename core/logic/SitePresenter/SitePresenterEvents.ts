import type { Event } from "@core/Event/EventEmitter";
import type { ReadonlyCatalog } from "@core/FileStructue/Catalog/ReadonlyCatalog";
import type { ArticlePageMode } from "@core/SitePresenter/types/ArticlePage";

export type SitePresenterContentContext = {
	getCatalog(): ReadonlyCatalog;
};

type SitePresenterEvents = Event<
	"before-return-content",
	{
		mutable: { content: unknown };
		context?: SitePresenterContentContext;
		mode: ArticlePageMode;
	}
>;

export default SitePresenterEvents;
