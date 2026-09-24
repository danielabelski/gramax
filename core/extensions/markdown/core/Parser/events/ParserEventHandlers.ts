import EventHandlerProvider from "@core/Event/EventHandlerProvider";
import type MarkdownParser from "../Parser";

export default class ParserEventHandlers extends EventHandlerProvider {
	constructor(_parser: MarkdownParser) {
		super();
		this._handlers = [];
	}
}
