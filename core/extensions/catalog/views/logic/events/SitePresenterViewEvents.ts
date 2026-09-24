import type { EventHandlerCollection } from "@core/Event/EventHandlerProvider";
import type SitePresenter from "@core/SitePresenter/SitePresenter";
import type { RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import filterTabsByView from "@ext/markdown/elements/tabs/render/logic/filterTabsByView";

export default class SitePresenterViewEvents implements EventHandlerCollection {
	private _refs = [];

	constructor(private _sitePresenter: SitePresenter) {}

	mount(): void {
		this._refs.push(
			this._sitePresenter.events.on("before-return-content", ({ mutable, context }) => {
				const resolvedView = context?.getCatalog?.()?.props?.resolvedView;
				if (!resolvedView) return;
				mutable.content = filterTabsByView(mutable.content as RenderableTreeNodes, resolvedView);
			}),
		);
	}
}
