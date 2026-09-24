import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";

const isCommentsResource = (entry: DiffFlattenTreeAnyItem): boolean =>
	entry.type === "resource" &&
	(entry.filepath.new.endsWith(".comments.yaml") || entry.filepath.old.endsWith(".comments.yaml"));

export const isDiffEntryVisible = (entry: DiffFlattenTreeAnyItem, extendedMode: boolean): boolean => {
	if (extendedMode || entry.type !== "resource") return true;
	return entry.indent <= 1 && !isCommentsResource(entry);
};

/** Сколько выбранных строк видит пользователь в текущем режиме отображения. */
export const countSelectedVisibleEntries = (
	changes: DiffFlattenTreeAnyItem[],
	extendedMode: boolean,
	isSelected: (entry: DiffFlattenTreeAnyItem) => boolean,
): number => changes?.filter((entry) => isDiffEntryVisible(entry, extendedMode) && isSelected(entry)).length ?? 0;
