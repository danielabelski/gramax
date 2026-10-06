import { uniqueName } from "@core/utils/uniqueName";

// macOS and Windows file systems ignore case, so `Gramax/workspace` and `gramax/workspace` are one folder.
// Comparing case-insensitively everywhere keeps a new workspace out of an existing one's folder.
export const isWorkspacePathTaken = (path: string, takenPaths: string[]) => {
	const normalized = path.toLowerCase();
	return takenPaths.some((p) => p.toLowerCase() === normalized);
};

export const suggestWorkspacePath = (defaultPath: string, takenPaths: string[]) =>
	uniqueName(`${defaultPath}/workspace`, takenPaths, "", undefined, true);
