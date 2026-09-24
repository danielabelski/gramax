import EventHandlerProvider from "@core/Event/EventHandlerProvider";
import type SitePresenter from "@core/SitePresenter/SitePresenter";
import SitePresenterViewEvents from "@ext/catalog/views/logic/events/SitePresenterViewEvents";

export default class SitePresenterEventHandlers extends EventHandlerProvider {
	constructor(sitePresenter: SitePresenter) {
		super();
		this._handlers = [new SitePresenterViewEvents(sitePresenter)];
	}
}
