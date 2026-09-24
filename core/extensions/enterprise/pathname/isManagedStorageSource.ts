import parseStorageUrl from "@core/utils/parseStorageUrl";
import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";

export const isManagedStorageSource = (config: Partial<WorkspaceConfig>, sourceName: string): boolean => {
	if (!sourceName) return false;

	const urls = [config.enterprise?.gesUrl, config.enterpriseCloud?.url];
	return urls.some((url) => url && parseStorageUrl(url).domain === sourceName);
};
