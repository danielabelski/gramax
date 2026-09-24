import { pickLfsPatternFor } from "@core/GitLfs/logic/autoLfsAttachments";

export type CollectAutoLfsPatternsInput = {
	/** Exclusion masks from `.doc-root.yaml`. */
	exclude: string[];
	/** Patterns that already carry `filter=lfs`. */
	patterns: string[];
	/** Attachment paths relative to the catalog root, as the articles reference them. */
	relPaths: string[];
};

/**
 * The masks a catalog needs so every referenced attachment goes through LFS. One mask per extension —
 * a per-file entry would bloat `.gitattributes` and break on rename — so a mask also covers
 * same-extension files no article points at, which otherwise stay permanently dirty.
 */
const collectAutoLfsPatterns = ({ exclude, patterns, relPaths }: CollectAutoLfsPatternsInput): string[] => {
	const collected = new Set<string>();

	for (const relPath of relPaths) {
		const pattern = pickLfsPatternFor({
			auto: true,
			exclude,
			// Do not delete `...collected` as dead code: it is unfalsifiable today only because
			// `pickLfsPatternFor` is keyed purely on the extension. The moment it can return a
			// directory-scoped mask, this is what stops a duplicate being added on top of the first.
			patterns: [...patterns, ...collected],
			relPath,
		});
		if (pattern) collected.add(pattern);
	}

	return Array.from(collected).sort();
};

export default collectAutoLfsPatterns;
