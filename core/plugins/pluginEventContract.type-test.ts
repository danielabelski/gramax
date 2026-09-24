import type { PluginEventMap } from "@gramax/sdk/events";

const syncHandler: PluginEventMap["git:branch:before-checkout"] = ({ catalogName, currentBranch, targetBranch }) => {
	const fields: [string, string, string] = [catalogName, currentBranch, targetBranch];
	return fields.every(Boolean) ? false : undefined;
};

const asyncHandler: PluginEventMap["git:branch:before-checkout"] = async () => false;

void syncHandler;
void asyncHandler;
