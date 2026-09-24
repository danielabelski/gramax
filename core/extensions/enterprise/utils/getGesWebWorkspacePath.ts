import type { Environment } from "@app/resolveModule/env";
import type { ClientWorkspaceConfig, WorkspacePath } from "@ext/workspace/WorkspaceConfig";

export const getGesWebWorkspacePath = (
	environment: Environment,
	activeGesUrl: string | undefined,
	workspaces: Pick<ClientWorkspaceConfig, "enterprise" | "path">[],
): WorkspacePath | undefined => {
	if (environment !== "web" || !activeGesUrl) return;

	return workspaces.find((workspace) => workspace.enterprise?.gesUrl === activeGesUrl)?.path;
};
