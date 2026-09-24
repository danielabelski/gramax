import type { WorkspaceSection } from "@ext/workspace/WorkspaceConfig";

type WorkspaceSections = Record<string, WorkspaceSection>;

export const resolvePersonalSections = (
	globalSections: WorkspaceSections,
	personalSections?: WorkspaceSections,
): WorkspaceSections => personalSections ?? globalSections;
