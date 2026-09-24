import useCheck from "@core-ui/hooks/useCheck";
import { useSettings } from "@ext/enterprise/components/admin/contexts/SettingsContext";
import { WorkspaceTemplateUploads } from "@ext/enterprise/components/admin/settings/workspace/components/WorkspaceTemplateUploads";
import { useWorkspaceSettings } from "@ext/enterprise/components/admin/settings/workspace/hooks/useWorkspaceSettings";
import { Page } from "@ext/enterprise/types/Page";
import { useMemo } from "react";
import { useTabGuard } from "../../hooks/useTabGuard";
import { SettingsPageLayout } from "../../ui-kit/SettingsPageLayout";
import { WorkspaceLfs } from "./components/lfs/WorkspaceLfs";
import { WorkspaceRepositories } from "./components/repositories/WorkspaceRepositories";
import { WorkspaceInfoDefault } from "./components/WorkspaceInfo";
import { WorkspaceStyling } from "./components/WorkspaceStyling";

const useWorkspaceComponentCommon = () => {
	const { settings, ensureLoaded, getTabError, isInitialLoading, isRefreshing } = useSettings();
	const workspaceSettings = settings?.workspace;

	const { localSettings, setLocalSettings, isSaving, handleInputChange, handleSave, saveError } =
		useWorkspaceSettings();

	const isEqual = useCheck(workspaceSettings, localSettings);

	const isWorkspaceInitialLoading = isInitialLoading("workspace");

	useTabGuard({
		page: Page.WORKSPACE,
		hasChanges: () => {
			if (isWorkspaceInitialLoading || !workspaceSettings) {
				return false;
			}
			return !isEqual;
		},
		onSave: handleSave,
		onDiscard: () => {
			if (workspaceSettings) setLocalSettings(workspaceSettings);
		},
	});

	const isSaveDisabled = !localSettings.name || !localSettings.git.source.url || isEqual;

	return {
		ensureLoaded,
		isSaving,
		isWorkspaceInitialLoading,
		isWorkspaceRefreshing: isRefreshing("workspace"),
		localSettings,
		saveError,
		setLocalSettings,
		settings,
		tabError: getTabError("workspace"),
		handleInputChange,
		handleSave,
		isSaveDisabled,
	};
};

const WorkspaceComponent = () => {
	const {
		ensureLoaded,
		handleInputChange,
		handleSave,
		isSaving,
		isWorkspaceInitialLoading,
		isWorkspaceRefreshing,
		localSettings,
		saveError,
		setLocalSettings,
		settings,
		tabError,
		isSaveDisabled,
	} = useWorkspaceComponentCommon();

	const selectResources = useMemo(
		() => settings?.resources?.map((resource) => resource.id) ?? [],
		[settings?.resources],
	);

	return (
		<SettingsPageLayout
			contentClassName="space-y-8"
			isInitialLoading={isWorkspaceInitialLoading}
			isRefreshing={isWorkspaceRefreshing}
			isSaveDisabled={isSaveDisabled}
			isSaving={isSaving}
			onRetry={() => ensureLoaded("workspace", true)}
			onSave={handleSave}
			page={Page.WORKSPACE}
			saveError={saveError}
			tabError={tabError}
		>
			<WorkspaceInfoDefault localSettings={localSettings} onInputChange={handleInputChange} />
			<WorkspaceRepositories
				localSettings={localSettings}
				selectResources={selectResources ?? []}
				setLocalSettings={setLocalSettings}
			/>
			<WorkspaceLfs localSettings={localSettings} setLocalSettings={setLocalSettings} />
			<WorkspaceStyling localSettings={localSettings} setLocalSettings={setLocalSettings} />
			<WorkspaceTemplateUploads localSettings={localSettings} setLocalSettings={setLocalSettings} />
		</SettingsPageLayout>
	);
};

export default WorkspaceComponent;
