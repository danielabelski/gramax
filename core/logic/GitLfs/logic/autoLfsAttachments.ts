import Path from "@core/FileProvider/Path/Path";
import isLfsArticleFile from "@core/GitLfs/logic/isLfsArticleFile";
import isLfsServiceFile from "@core/GitLfs/logic/isLfsServiceFile";
import matchGitAttributesPattern from "@core/GitLfs/logic/matchGitAttributesPattern";
import type { WorkspaceLfsPolicy } from "@core/GitLfs/logic/workspaceLfsPatterns";
import ResourceExtensions from "@core/Resource/ResourceExtensions";

/** The gitattributes attribute that routes a file into LFS. */
export const LFS_FILTER_ATTR = "filter=lfs";

/**
 * Text types outside `ResourceExtensions` that also gain nothing from an LFS pointer. Add here, not
 * to `DEFAULT_LFS_EXCLUDE` directly, so the split stays visible to the next person.
 */
const DEFAULT_LFS_EXCLUDE_TEXT = ["html"];

/**
 * What a brand-new catalog starts with: the diagram sources (Gramax edits these in-app, so behind an
 * LFS pointer the editors would be handed the pointer text) plus other text types that are small and
 * readable besides. Diagrams are taken from `ResourceExtensions.diagrams` so the two lists cannot
 * drift apart; the rest is `DEFAULT_LFS_EXCLUDE_TEXT` above.
 */
export const DEFAULT_LFS_EXCLUDE = [...ResourceExtensions.diagrams, ...DEFAULT_LFS_EXCLUDE_TEXT].map(
	(extension) => `*.${extension}`,
);

/** The `lfs` block of `.doc-root.yaml`. Absent `auto` means the catalog predates the feature. */
export type AutoLfsProps = {
	auto?: boolean;
	exclude?: string[];
};

/**
 * The defaults plus whatever a catalog adds on top. They are not a starting point the user edits
 * away — the settings list shows them locked — so every list that reaches the write path carries
 * them, whatever the catalog happens to store.
 */
export const withDefaultLfsExclude = (extra: string[]): string[] => [...new Set([...DEFAULT_LFS_EXCLUDE, ...extra])];

/**
 * The extras alone: what a catalog stores and the settings list lets the user remove. Keeping the
 * defaults out of `.doc-root.yaml` means a stored copy of them can never drift from the list above —
 * and a catalog written before they were implicit reads back the same way.
 */
export const customLfsExclude = (exclude: string[] | undefined): string[] =>
	(exclude ?? []).filter((pattern) => !DEFAULT_LFS_EXCLUDE.includes(pattern));

/**
 * The exclusion list a command must act on: an explicit `requested` if there is one, else what the
 * catalog stored — the defaults and whatever the workspace excludes joining either way. Shared so the
 * stats dialog and the enable it leads to cannot answer differently.
 *
 * The three tiers add up rather than override: a workspace excluding one more type does not throw away
 * what a catalog excludes, and neither can drop a default.
 */
export const resolveLfsExclude = (
	requested: string[] | undefined,
	stored: AutoLfsProps | undefined,
	policy?: WorkspaceLfsPolicy,
): string[] => withDefaultLfsExclude([...(policy?.exclude ?? []), ...(requested ?? stored?.exclude ?? [])]);

/**
 * Whether attachments go to LFS. A workspace that states a policy decides for its catalogs — the
 * switch reads it and is not editable there — and a catalog that was never asked stays off.
 */
export const resolveAutoLfs = (policy: WorkspaceLfsPolicy | undefined, stored: AutoLfsProps | undefined): boolean =>
	policy?.auto ?? stored?.auto ?? false;

export type PickLfsPatternInput = {
	auto: boolean;
	exclude: string[];
	/** Patterns that already carry `filter=lfs`, as `GitAttributes.findPatternsByAttr` returns them. */
	patterns: string[];
	/** Path of the attachment relative to the catalog root, forward slashes. */
	relPath: string;
};

/**
 * The mask this attachment needs, or `null` when it needs none — shared by the write path and the
 * migration collector so both answer identically.
 */
export const pickLfsPatternFor = ({ auto, exclude, patterns, relPath }: PickLfsPatternInput): string | null => {
	if (!auto) return null;
	if (isLfsServiceFile(relPath)) return null;
	if (isLfsArticleFile(relPath)) return null;

	const extension = new Path(relPath).extension;
	if (!extension) return null;

	if (exclude.some((pattern) => matchGitAttributesPattern(pattern, relPath))) return null;
	if (patterns.some((pattern) => matchGitAttributesPattern(pattern, relPath))) return null;

	return `*.${extension}`;
};
