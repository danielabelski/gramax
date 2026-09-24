import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import type SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";
import type { IconCode } from "@ui-kit/Icon";

export const STORAGE_GET_ICON: { [type in SourceType]: IconCode } = {
	Git: "git-branch",
	GitLab: "gitlab",
	GitHub: "github",
	GitVerse: "gitverse",
	Gitea: "gitea",
	"Confluence Cloud": "confluence cloud",
	"Confluence self-hosted server": "confluence cloud",
	Notion: "notion",
};

const getStorageIconByData = (data: SourceData): IconCode => {
	return STORAGE_GET_ICON[data.sourceType];
};

export default getStorageIconByData;
