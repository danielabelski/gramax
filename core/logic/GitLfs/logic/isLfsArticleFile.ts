import Path from "@core/FileProvider/Path/Path";
import { MarkdownExtension } from "@core/FileStructue/Item/ItemExtensions";

/**
 * The extensions a catalog's own prose is written in. Sparing service files by name does not save a
 * catalog whose every article is a pointer, and a single `*.md` mask does exactly that: a lazy clone
 * then hands the renderer the pointer text instead of the article. So no mask may cover them.
 */
const ARTICLE_EXTENSIONS: ReadonlySet<string> = new Set([MarkdownExtension]);

/** `relPath` is relative to the catalog root. */
const isLfsArticleFile = (relPath: string): boolean =>
	ARTICLE_EXTENSIONS.has(new Path(relPath).extension?.toLowerCase() ?? "");

export default isLfsArticleFile;
