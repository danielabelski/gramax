import { addScopeToPath } from "@ext/versioning/addScopeToPath";

// The diff view loads the article twice, from two independent fetches: the document shown in the
// editable pane comes from the diff item (`getDiffItemContent` for the item's path), while the save
// target — `articleProps.ref.path`, which every write URL is built from — comes from the scoped
// article context. While those two disagree, saving writes one article's body over another article's
// file, and the overwritten file is a real, unrelated article. Compare them before every write.
//
// Scope suffixes are stripped: a revision/HEAD context resolves to `<root>:<scope>/…`, the diff item
// path is always plain, and the two still denote the same article.
export const matchesDiffArticle = (loadedArticlePath: string, diffItemPath: string): boolean => {
	if (!loadedArticlePath || !diffItemPath) return false;
	return addScopeToPath(loadedArticlePath) === addScopeToPath(diffItemPath);
};

export default matchesDiffArticle;
