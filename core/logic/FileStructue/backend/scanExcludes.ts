const functionalFolders = [".git", ".idea", ".vscode", "node_modules", ".DS_Store"];

/** Names a catalog walk never descends into or reports as an item. */
export const FS_EXCLUDE_FILENAMES = [
	...functionalFolders,
	".snippets", // legacy
	".icons",
	".gramax",
	".claude",
	".codex",
];

/** Names a workspace walk never treats as a catalog directory. */
export const FS_EXCLUDE_CATALOG_NAMES = [
	...functionalFolders,
	"IndexCaches", // Legacy
	".storage",
	".workspace",
];
