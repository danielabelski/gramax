import type PageDataContext from "@core/Context/PageDataContext";
import type { WorkspacePath } from "@ext/workspace/WorkspaceConfig";

/** The server and workspace a copy was taken in: catalog names and article paths repeat across both. */
export interface ClipboardOrigin {
	domain: string;
	workspace: WorkspacePath;
}

export const getClipboardOrigin = (pageDataContext: PageDataContext): ClipboardOrigin => ({
	domain: pageDataContext?.domain,
	workspace: pageDataContext?.workspace?.current,
});

export const isSameClipboardOrigin = (source: ClipboardOrigin, target: ClipboardOrigin): boolean =>
	!!source?.domain && !!source.workspace && source.domain === target?.domain && source.workspace === target.workspace;
