import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { useAgentChatVisibility } from "@ext/agent/components/hooks/useAgentChatVisibility";
import CatalogPropsEditorBody from "@ext/catalog/actions/propsEditor/components/CatalogPropsEditorBody";
import {
	type SettingsTab as CatalogSettingsTab,
	SettingsTabs as CatalogSettingsTabs,
	GitSettingsTabs,
} from "@ext/catalog/actions/propsEditor/components/Sections";
import t from "@ext/localization/locale/translate";
import {
	AppSettingsSidebarTabsRenderer,
	type SidebarButtonItem,
	type SidebarItem,
} from "@ext/settings/components/AppSettingsSidebarTabsRenderer";
import { Level } from "@ext/settings/logic/settings";
import {
	currentFeatureTarget,
	type DefinedFeatures,
	FeatureTarget,
	feature as isFeatureEnabled,
} from "@ext/toggleFeatures/features";
import EditWorkspaceFormBody, {
	WORKSPACE_TABS,
	type WorkspaceTab,
} from "@ext/workspace/components/EditWorkspaceFormBody";
import type { IconCode } from "@ui-kit/Icon";
import { SidebarGroupLabel } from "@ui-kit/Sidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppSettingsTab } from "../logic/formSchema";
import AppSettingsEditorLayout, { type AppSettingsEditorProps } from "./AppSettingsEditorLayout";
import { SettingsDirtyProvider } from "./SettingsDirtyContext";
import { ContentCompareSection } from "./sections/ContentCompareSection";
import DiagnosticsSection from "./sections/DiagnosticsSection";
import ExperimentalSection from "./sections/ExperimentalSection";
import GeneralSection from "./sections/GeneralSection";
import KeysAndPasswordsSection from "./sections/KeysAndPasswordsSection";
import ServicesSection from "./sections/ServicesSection";
import UpdatesSection from "./sections/UpdatesSection";
import settingsLevelHeader from "./settingsLevelHeader";
import { useAppSettingsEditorForm } from "./useAppSettingsEditorForm";

type AppTabLabel =
	| "general"
	| "services"
	| "diagnostics"
	| "experimental-features"
	| "updates"
	| "editor"
	| "content-compare"
	| "keys-passwords"
	| "ai-agent";

export type AppTab = SidebarItem & {
	label: AppTabLabel;
	platforms?: FeatureTarget;
	features?: DefinedFeatures[];
	children?: (SidebarButtonItem & { label: AppTabLabel })[];
};

const APP_TABS: AppTab[] = [
	{ type: "button", key: "general", icon: "settings", label: "general" },
	{ type: "button", key: "services", icon: "server", label: "services" },
	{
		type: "button",
		key: "ai-agent",
		icon: "bot",
		label: "ai-agent",
		children: [{ type: "button", key: "keys-passwords", icon: "key-round", label: "keys-passwords" }],
	},
	{
		type: "button",
		key: "updates",
		icon: "refresh-ccw",
		label: "updates",
		platforms: FeatureTarget.desktop,
	},
	{
		type: "button",
		key: "diagnostics",
		icon: "activity",
		label: "diagnostics",
	},
	{
		type: "button",
		key: "experimental-features",
		icon: "code",
		label: "experimental-features",
	},
	{ type: "title", key: "editor", label: "editor", features: ["new-diffs"] },
	{
		type: "button",
		key: "contentCompare",
		icon: "diff",
		label: "content-compare",
		features: ["new-diffs"],
	},
];

const AppSettingsEditor = ({
	defaultLevel = Level.app,
	defaultAppTab = "general",
	onClose,
	onCatalogSubmit,
	modalContentProps,
}: AppSettingsEditorProps) => {
	const workspace = WorkspaceService.current();
	const { showToggle: isAgentAvailable } = useAgentChatVisibility();
	const catalogProps = useCatalogPropsStore((state) => state.data);
	const hasCatalog = !!catalogProps;
	const sourceName = useCatalogPropsStore((state) => state.data?.sourceName);
	const hasGitSource = !!sourceName;
	// GES-managed workspaces are configured through the GES admin panel
	// (see SwitchWorkspace), so the local Workspace level is unavailable.
	const isGesWorkspace = !!workspace?.enterprise?.gesUrl;
	const isGesCloudWorkspace = !!workspace?.enterpriseCloud?.url;
	const canEditWorkspace = !!workspace && !isGesWorkspace && !isGesCloudWorkspace;

	const resolveInitialLevel = useCallback(
		(next: Level): Level => {
			if (next === Level.workspace && !canEditWorkspace) return Level.app;
			if (next === Level.catalog && !hasCatalog) return Level.app;
			return next;
		},
		[canEditWorkspace, hasCatalog],
	);

	const [level] = useState<Level>(() => resolveInitialLevel(defaultLevel));
	const [appActiveTab, setAppActiveTab] = useState<AppSettingsTab>(defaultAppTab);
	const [workspaceActiveTab, setWorkspaceActiveTab] = useState<WorkspaceTab>("general");
	const [catalogActiveTab, setCatalogActiveTab] = useState<CatalogSettingsTab>("general");

	useEffect(() => {
		if (!hasGitSource && catalogActiveTab in GitSettingsTabs) setCatalogActiveTab("general");
	}, [hasGitSource, catalogActiveTab]);

	const editor = useAppSettingsEditorForm({ onClose });
	const {
		confirmationDialog,
		dirtyContextValue,
		form,
		onCloseHandler,
		onDialogOpenChange,
		open,
		renderAppForm,
		isDiagnosticsAvailable,
	} = editor;

	const header = useMemo(() => settingsLevelHeader(level), [level]);

	const renderSection = () => {
		switch (appActiveTab) {
			case "general":
				return <GeneralSection />;
			case "services":
				return <ServicesSection showReset />;
			case "keys-passwords":
				return <KeysAndPasswordsSection />;
			case "updates":
				return <UpdatesSection onClose={onCloseHandler} />;
			case "diagnostics":
				return <DiagnosticsSection />;
			case "experimental-features":
				return <ExperimentalSection />;
			case "contentCompare":
				return <ContentCompareSection form={form} />;
		}
	};

	const visibleAppTabs = useMemo(
		() =>
			APP_TABS.filter(
				(tab) =>
					(tab.platforms === undefined || (tab.platforms & currentFeatureTarget()) !== 0) &&
					(tab.features === undefined || tab.features.every(isFeatureEnabled)),
			)
				.filter((tab) => tab.key !== "diagnostics" || isDiagnosticsAvailable())
				.filter((tab) => tab.key !== "ai-agent" || isAgentAvailable),
		[isDiagnosticsAvailable, isAgentAvailable],
	);

	useEffect(() => {
		const isVisible = visibleAppTabs.some(
			(tab) => tab.key === appActiveTab || tab.children?.some((child) => child.key === appActiveTab),
		);
		if (!isVisible) setAppActiveTab("general");
	}, [appActiveTab, visibleAppTabs]);

	const appTabItems = useMemo<SidebarItem[]>(
		() =>
			visibleAppTabs.map(({ platforms: _platforms, features: _features, ...tab }) => ({
				...tab,
				label: t(`app-settings.tabs.${tab.label}` as const),
				children: tab.children?.map((child) => ({
					...child,
					label: t(`app-settings.tabs.${child.label}` as const),
				})),
			})),
		[visibleAppTabs],
	);

	const workspaceTabItems = useMemo<SidebarItem[]>(
		() =>
			(
				Object.entries(WORKSPACE_TABS) as [WorkspaceTab, (typeof WORKSPACE_TABS)[keyof typeof WORKSPACE_TABS]][]
			).map(([_, tab]) => ({
				type: tab.type,
				key: tab.key,
				icon: tab.icon,
				label: t(tab.label as Parameters<typeof t>[0]),
			})),
		[],
	);

	const catalogTabItems = useMemo<SidebarItem[]>(
		() =>
			Object.entries(CatalogSettingsTabs).map(([key, tab]) => ({
				type: tab.type,
				key: tab.key,
				icon: tab.icon as IconCode,
				label: t(`forms.catalog-edit-props.tabs.${key as CatalogSettingsTab}`),
			})),
		[],
	);

	const gitTabItems = useMemo<SidebarItem[]>(
		() =>
			Object.entries(GitSettingsTabs).map(([key, tab]) => ({
				type: tab.type,
				key: tab.key,
				icon: tab.icon as IconCode,
				label: t(`forms.catalog-edit-props.tabs.${key as CatalogSettingsTab}`),
			})),
		[],
	);

	const sidebarTabs = (() => {
		if (level === Level.app)
			return (
				<AppSettingsSidebarTabsRenderer
					active={appActiveTab}
					items={appTabItems}
					onChange={(key) => setAppActiveTab(key as AppSettingsTab)}
				/>
			);
		if (level === Level.workspace)
			return (
				<AppSettingsSidebarTabsRenderer
					active={workspaceActiveTab}
					items={workspaceTabItems}
					onChange={(key) => setWorkspaceActiveTab(key as WorkspaceTab)}
				/>
			);
		if (level === Level.catalog)
			return (
				<>
					<AppSettingsSidebarTabsRenderer
						active={catalogActiveTab}
						items={catalogTabItems}
						onChange={(key) => setCatalogActiveTab(key as CatalogSettingsTab)}
					/>
					{hasGitSource && (
						<>
							<SidebarGroupLabel>{t("forms.catalog-edit-props.sidebar.git")}</SidebarGroupLabel>
							<AppSettingsSidebarTabsRenderer
								active={catalogActiveTab}
								items={gitTabItems}
								onChange={(key) => setCatalogActiveTab(key as CatalogSettingsTab)}
							/>
						</>
					)}
				</>
			);
		return null;
	})();

	const mainContent = (() => {
		if (level === Level.app) return renderAppForm(renderSection());
		if (level === Level.workspace && workspace) {
			return (
				<EditWorkspaceFormBody activeTab={workspaceActiveTab} onClose={onCloseHandler} workspace={workspace} />
			);
		}
		if (level === Level.catalog) {
			return (
				<CatalogPropsEditorBody
					activeTab={catalogActiveTab}
					onClose={onCloseHandler}
					onSubmit={onCatalogSubmit}
				/>
			);
		}
		return null;
	})();

	return (
		<AppSettingsEditorLayout
			confirmationDialog={confirmationDialog}
			mainContent={<SettingsDirtyProvider value={dirtyContextValue}>{mainContent}</SettingsDirtyProvider>}
			modalContentProps={modalContentProps}
			onClose={onCloseHandler}
			onDialogOpenChange={onDialogOpenChange}
			open={open}
			sidebarTabs={sidebarTabs}
			size={level === Level.app ? "L" : "M"}
			title={header.title}
		/>
	);
};

export type { AppSettingsEditorProps } from "./AppSettingsEditorLayout";

export default AppSettingsEditor;
