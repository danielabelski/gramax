import type { ClientItemRef } from "@core/SitePresenter/SitePresenter";
import type { EditArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";

class ArticleUpdater {
	private _onUpdate: (data: EditArticlePageData) => void;
	private _isShown: (ref: ClientItemRef) => boolean;
	private _listeners = new Set<(data: EditArticlePageData) => void>();

	bindOnUpdate(onUpdate: (data: EditArticlePageData) => void, isShown: (ref: ClientItemRef) => boolean) {
		this._onUpdate = onUpdate;
		this._isShown = isShown;
	}

	onUpdated(listener: (data: EditArticlePageData) => void) {
		this._listeners.add(listener);
		return () => this._listeners.delete(listener);
	}

	async update(apiUrlCreator: ApiUrlCreator) {
		if (!this._onUpdate) return;
		// No article is open (workspace home page, catalog home) — there is nothing to refresh.
		// Asking `page/getArticlePageData` without a path crashed the app instead (#910).
		if (!apiUrlCreator?.articlePath) return;
		const data = await this._getUpdateDate(apiUrlCreator);
		// The reader may have moved to another article while this was read — a sync finishing late.
		if (!data || !this._isShown(data.articleProps.ref)) return;

		this._onUpdate?.(data);
		this._listeners.forEach((listener) => listener(data));
	}

	private async _getUpdateDate(apiUrlCreator: ApiUrlCreator): Promise<EditArticlePageData | null> {
		const response = await FetchService.fetch(apiUrlCreator.getArticlePageData());
		if (!response?.ok) return null;
		const body = (await response.json?.()) as { data?: EditArticlePageData } | null;
		return body?.data ?? null;
	}
}

const ArticleUpdaterService = new ArticleUpdater();

export default ArticleUpdaterService;
