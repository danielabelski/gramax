import { useAgentChatVisibility } from "@ext/agent/components/hooks/useAgentChatVisibility";
import type { SettingsTab as CatalogSettingsTab } from "@ext/catalog/actions/propsEditor/components/Sections";
import t from "@ext/localization/locale/translate";
import {
	AppSettingsSidebarTabsRenderer,
	type SidebarButtonItem,
	type SidebarItem,
} from "@ext/settings/components/AppSettingsSidebarTabsRenderer";
import type { AppSettingsTab } from "@ext/settings/logic/formSchema";
import { Level } from "@ext/settings/logic/settings";
import type { DefinedFeatures, FeatureTarget } from "@ext/toggleFeatures/features";
import { SidebarGroupLabel } from "@ui-kit/Sidebar";
import { useCallback, useMemo, useState } from "react";
import { useCatalogPropsStore } from "../../../ui-logic/stores/CatalogPropsStore/CatalogPropsStore.provider";
import CatalogPropsEditorBody from "../../catalog/actions/propsEditor/components/CatalogPropsEditorBody";
import AppSettingsEditorLayout, {
	type AppSettingsEditorProps,
} from "../../settings/components/AppSettingsEditorLayout";
import { SettingsDirtyProvider } from "../../settings/components/SettingsDirtyContext";
import DiagnosticsSection from "../../settings/components/sections/DiagnosticsSection";
import ExperimentalSection from "../../settings/components/sections/ExperimentalSection";
import GeneralSection from "../../settings/components/sections/GeneralSection";
import KeysAndPasswordsSection from "../../settings/components/sections/KeysAndPasswordsSection";
import settingsLevelHeader from "../../settings/components/settingsLevelHeader";
import { useAppSettingsEditorForm } from "../../settings/components/useAppSettingsEditorForm";
import { useCatalogSettingsSidebarTabs } from "../../settings/components/useCatalogSettingsSidebarTabs";

type CloudAppTabLabel = "general" | "keys-passwords" | "ai-agent" | "diagnostics" | "experimental-features";

type CloudAppTab = SidebarItem & {
	label: CloudAppTabLabel;
	platforms?: FeatureTarget;
	features?: DefinedFeatures[];
	children?: (SidebarButtonItem & { label: CloudAppTabLabel })[];
};

const CLOUD_APP_TABS: CloudAppTab[] = [
	{ type: "button", key: "general", icon: "settings", label: "general" },
	{
		type: "button",
		key: "ai-agent",
		icon: "bot",
		label: "ai-agent",
		children: [{ type: "button", key: "keys-passwords", icon: "key-round", label: "keys-passwords" }],
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
];

const GesCloudAppSettingsEditor = ({
	defaultLevel = Level.app,
	defaultAppTab = "general",
	onClose,
	onCatalogSubmit,
	modalContentProps,
}: AppSettingsEditorProps) => {
	const { showToggle: isAgentAvailable } = useAgentChatVisibility();
	const catalogProps = useCatalogPropsStore((state) => state.data);
	const hasCatalog = !!catalogProps;

	const resolveInitialLevel = useCallback(
		(next: Level): Level => {
			if (next === Level.catalog && !hasCatalog) return Level.app;
			return next;
		},
		[hasCatalog],
	);

	const [level] = useState<Level>(() => resolveInitialLevel(defaultLevel));
	const [appActiveTab, setAppActiveTab] = useState<AppSettingsTab>(defaultAppTab);

	const editor = useAppSettingsEditorForm({ onClose });

	const header = useMemo(() => settingsLevelHeader(level), [level]);

	const { catalogActiveTab, setCatalogActiveTab, hasGitSource, catalogTabItems, gitTabItems } =
		useCatalogSettingsSidebarTabs();

	const appTabItems = useMemo<SidebarItem[]>(
		() =>
			CLOUD_APP_TABS.filter((tab) => tab.key !== "ai-agent" || isAgentAvailable).map((tab) => ({
				...tab,
				label: t(`app-settings.tabs.${tab.label}` as const),
				children: tab.children?.map((child) => ({
					...child,
					label: t(`app-settings.tabs.${child.label}` as const),
				})),
			})),
		[isAgentAvailable],
	);

	const renderSection = () => {
		switch (appActiveTab) {
			case "general":
				return <GeneralSection />;
			case "keys-passwords":
				return <KeysAndPasswordsSection />;
			case "diagnostics":
				return <DiagnosticsSection />;
			case "experimental-features":
				return <ExperimentalSection />;
		}
	};

	const mainContent =
		level === Level.catalog ? (
			<CatalogPropsEditorBody
				activeTab={catalogActiveTab}
				onClose={editor.onCloseHandler}
				onSubmit={onCatalogSubmit}
			/>
		) : (
			editor.renderAppForm(renderSection())
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

	return (
		<AppSettingsEditorLayout
			confirmationDialog={editor.confirmationDialog}
			mainContent={<SettingsDirtyProvider value={editor.dirtyContextValue}>{mainContent}</SettingsDirtyProvider>}
			modalContentProps={modalContentProps}
			onClose={editor.onCloseHandler}
			onDialogOpenChange={editor.onDialogOpenChange}
			open={editor.open}
			sidebarTabs={sidebarTabs}
			size={level === Level.app ? "L" : "M"}
			title={header.title}
		/>
	);
};

export default GesCloudAppSettingsEditor;
