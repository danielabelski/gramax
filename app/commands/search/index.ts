import chat from "./chat";
import chatAvailable from "./chatAvailable";
import getIndexingProgress from "./getIndexingProgress";
import resetSearchData from "./resetSearchData";
import searchCommand from "./searchCommand";

const search = {
	resetSearchData,
	searchCommand,
	chat,
	chatAvailable,
	getIndexingProgress,
};

export default search;
