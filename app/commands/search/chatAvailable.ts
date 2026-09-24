import { ResponseKind } from "@app/types/ResponseKind";
import { Command } from "../../types/Command";

const chatAvailable: Command<void, boolean> = Command.create({
	path: "search/chatAvailable",

	kind: ResponseKind.json,

	async do() {
		if (!this._app.searcherManager.hasChatBotSearcher()) return false;
		return await this._app.searcherManager.getChatBotSearcher().checkConnection();
	},
});

export default chatAvailable;
