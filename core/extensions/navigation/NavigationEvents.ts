import { createEventEmitter, type Event, type UnsubscribeToken } from "@core/Event/EventEmitter";
import type { ClientArticleProps, ClientItemRef } from "@core/SitePresenter/SitePresenter";

export type NavigationEvents = Event<"item-click", { path: string; mutable: { preventGoto?: boolean } }> &
	Event<"item-create", { path: string; mutable: { preventGoto?: boolean } }> &
	Event<"item-delete", { path: string; mutable: { preventGoto?: boolean } }> &
	/**
	 * The open article moved: emitted before the url is replaced, so listeners update in place.
	 * `view` is the article view the rename was started in — the path in `from` may already belong
	 * to another article by the time the response lands.
	 */
	Event<
		"item-rename",
		{ from: ClientItemRef; patch: ItemRenamePatch; view: string | null; mutable: { preventGoto?: boolean } }
	>;

/** What the article became. Listeners merge it — substituting would roll back whatever was typed since. */
export type ItemRenamePatch = Pick<ClientArticleProps, "ref" | "pathname" | "fileName" | "logicPath" | "title">;

abstract class NavigationEventsService {
	private static _eventEmitter = createEventEmitter<NavigationEvents>();

	public static on<K extends keyof NavigationEvents>(event: K, listener: NavigationEvents[K]): UnsubscribeToken {
		return this._eventEmitter.on(event, listener);
	}

	public static off(token: UnsubscribeToken): void {
		this._eventEmitter.off(token);
	}

	public static async emit<K extends keyof NavigationEvents>(
		event: K,
		payload: Parameters<NavigationEvents[K]>[0],
	): Promise<void> {
		await this._eventEmitter.emit(event, payload);
	}
}

export default NavigationEventsService;
