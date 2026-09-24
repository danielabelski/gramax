import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import PermissionService from "@ext/security/logic/Permission/components/PermissionService";
import { editCatalogPermission } from "@ext/security/logic/Permission/Permissions";
import { useWorkspaceAi } from "@ext/workspace/components/useWorkspaceAi";
import { useEffect, useState, useSyncExternalStore } from "react";

export const AGENT_BROWSER_REVEAL_ENABLED_KEY = "agent-browser-reveal-enabled";

// Without this cache each new mount starts with hasServerConfig=false, so opening
// settings from the skills menu briefly hides the keys tab and falls back to General.
const hasServerConfigByWorkspace = new Map<string, boolean>();

const subscribeStorage = (notify: () => void): (() => void) => {
	if (typeof window === "undefined") return () => {};
	window.addEventListener("storage", notify);
	return () => window.removeEventListener("storage", notify);
};

export const getAgentBrowserRevealEnabledSnapshot = (): boolean =>
	typeof window !== "undefined" && window.localStorage?.getItem(AGENT_BROWSER_REVEAL_ENABLED_KEY) === "true";

const getServerSnapshot = (): boolean => false;

const useAgentBrowserRevealEnabled = (): boolean =>
	useSyncExternalStore(subscribeStorage, getAgentBrowserRevealEnabledSnapshot, getServerSnapshot);

export interface AgentChatVisibility {
	showToggle: boolean;
	showBrowserReveal: boolean;
}

export const useAgentChatVisibility = (): AgentChatVisibility => {
	const { isWeb, isTauri } = usePlatform();
	const workspacePath = WorkspaceService.current()?.path ?? "";
	const conf = PageDataContextService.value?.conf;
	const isGes = !!conf?.enterprise?.gesUrl;
	const isGesCloud = Boolean(conf?.enterpriseCloud?.url && conf?.enterpriseCloud?.enabled);
	const { getData } = useWorkspaceAi(workspacePath);
	const [hasServerConfig, setHasServerConfig] = useState(
		() => hasServerConfigByWorkspace.get(workspacePath) ?? false,
	);
	const browserRevealEnabled = useAgentBrowserRevealEnabled();
	const canEditCatalog = PermissionService.useCheckPermission(editCatalogPermission, workspacePath);

	useEffect(() => {
		if (!workspacePath) {
			setHasServerConfig(false);
			return;
		}

		let cancelled = false;
		void (async () => {
			const data = await getData();
			const next = Boolean(data?.aiApiUrl && data?.aiToken);
			hasServerConfigByWorkspace.set(workspacePath, next);
			if (!cancelled) setHasServerConfig(next);
		})();

		return () => {
			cancelled = true;
		};
	}, [workspacePath, getData]);

	const isEditorPlatform = isWeb || isTauri;
	//TODO: temprorary fix for GES: the client decides by the AI server URL and token it received.
	// GES Cloud proxies agent requests through its backend, so those secrets never reach the client.
	// Should be replaced with a check endpoint on backend that checks if AI-agent is configured.
	const isAvailable = isEditorPlatform && (isGesCloud || (isGes && hasServerConfig && canEditCatalog));

	return {
		showToggle: isAvailable,
		showBrowserReveal: browserRevealEnabled,
	};
};
