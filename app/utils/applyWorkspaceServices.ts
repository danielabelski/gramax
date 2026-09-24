import { getExecutingEnvironment } from "@app/resolveModule/env";
import type SettingsResolver from "@ext/settings/logic/SettingsResolver";
import type { Workspace } from "@ext/workspace/Workspace";
import setWorkerProxy from "../../apps/web/src/logic/setWorkerProxy";
import { statesEmptyService } from "./resolveWorkspaceServices";

/**
 * The web worker keeps whatever proxy it is sent, so every workspace switch has to send one —
 * an empty workspace that sent nothing would keep the previous workspace's address and carry it
 * inside every git path. `resolveServices` layers workspace settings over the app ones, but a
 * deliberately empty endpoint survives only in the legacy `services` block: the settings
 * migration maps URLs and drops empty ones.
 */
const applyWorkspaceServices = (settings: SettingsResolver, workspace?: Workspace | null): void => {
	if (getExecutingEnvironment() !== "web") return;
	const resolved = settings.resolveServices(workspace)?.["git-proxy"]?.endpoint;
	const gitProxy = statesEmptyService(workspace?.yaml().get("services")?.gitProxy) ? null : resolved;
	setWorkerProxy(gitProxy || null);
};

export default applyWorkspaceServices;
