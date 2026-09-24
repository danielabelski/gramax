import {
	type SettingsTab as CatalogSettingsTab,
	SettingsTabs as CatalogSettingsTabs,
} from "@ext/catalog/actions/propsEditor/components/Sections";
import t from "@ext/localization/locale/translate";
import type { IconCode } from "@ui-kit/Icon";
import { useEffect, useMemo, useState } from "react";
import { useCatalogPropsStore } from "../../../ui-logic/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { GitSettingsTabs } from "../../catalog/actions/propsEditor/components/Sections";
import type { SidebarItem } from "./AppSettingsSidebarTabsRenderer";

export const useCatalogSettingsSidebarTabs = () => {
	const [catalogActiveTab, setCatalogActiveTab] = useState<CatalogSettingsTab>("general");
	const sourceName = useCatalogPropsStore((state) => state.data?.sourceName);
	const hasGitSource = !!sourceName;

	useEffect(() => {
		if (!hasGitSource && catalogActiveTab in GitSettingsTabs) setCatalogActiveTab("general");
	}, [hasGitSource, catalogActiveTab]);

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

	return {
		catalogActiveTab,
		setCatalogActiveTab,
		hasGitSource,
		catalogTabItems,
		gitTabItems,
	};
};
