import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { SettingsContext, type SettingsContextType } from "@ext/enterprise/components/admin/contexts/SettingsContext";
import type { ResourcesSettings } from "@ext/enterprise/components/admin/settings/resources/types/ResourcesComponent";
import { type Settings, type TabKey, tabKeys } from "@ext/enterprise/types/EnterpriseAdmin";
import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { type GesErrorCode, toGesErrorCode } from "../../../../enterprise/errors/GesError";
import { GesCloudApi } from "../../../GesCloudApi";

const unsupported = async (): Promise<never> => {
	throw new Error("This settings operation is not implemented in enterprise-cloud");
};

const unsupportedSso = async (): Promise<never> => {
	throw new Error("SSO is not supported in enterprise-cloud");
};

const accessTabs = ["resources", "groups", "editors", "workspace"] as const;

const makeTabKeyMap = <T,>(val: T) => Object.fromEntries(tabKeys.map((t) => [t, val])) as Record<TabKey, T>;

const setAccessTabsValue = <T,>(setter: Dispatch<SetStateAction<Record<TabKey, T>>>, value: T) => {
	setter((prev) => {
		const next = { ...prev };
		for (const tab of accessTabs) next[tab] = value;
		return next;
	});
};
interface GesCloudSettingsProviderProps {
	children: ReactNode;
}

export const GesCloudWsSettingsProvider = ({ children }: GesCloudSettingsProviderProps) => {
	const [settings, setSettings] = useState<Partial<Settings>>({});
	const [allGitResources, setAllGitResources] = useState<string[]>([]);

	const [hasLoadedAccessSettings, setHasLoadedAccessSettings] = useState(false);
	const [initialLoading, setInitialLoading] = useState<Record<TabKey, boolean>>(makeTabKeyMap(true));
	const [refreshing, setRefreshing] = useState<Record<TabKey, boolean>>(makeTabKeyMap(false));
	const [tabErrors, setTabErrors] = useState<Record<TabKey, GesErrorCode | null>>(
		makeTabKeyMap<GesErrorCode | null>(null),
	);

	const { url: gesUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesUrl), [gesUrl]);

	const addResource = useCallback(
		async (resource: ResourcesSettings) => {
			await gesCloudApi.saveGitResource(resource);
		},
		[gesCloudApi],
	);

	const deleteResources = useCallback(
		async (resourceIds: string[]) => {
			await gesCloudApi.deleteGitResources(resourceIds);
		},
		[gesCloudApi],
	);

	const searchBranches = useCallback(
		async (resourceId: string) => {
			const branches = await gesCloudApi.searchGitBranches(resourceId);
			return branches;
		},
		[gesCloudApi],
	);

	const loadAccessSettings = useCallback(
		async (force = false) => {
			const isInitial = !hasLoadedAccessSettings && !force;

			if (isInitial) setAccessTabsValue(setInitialLoading, true);
			else setAccessTabsValue(setRefreshing, true);

			setAccessTabsValue(setTabErrors, null);

			try {
				const [repositoryData, allGitResourcesData] = await Promise.all([
					gesCloudApi.getRepositoryData(),
					gesCloudApi.getGitResources(),
				]);

				setSettings((prev) => ({
					...prev,
					resources: repositoryData.resources ?? [],
					editors: repositoryData.editors ?? { count: 0, editors: [] },
					workspace: repositoryData.workspace ?? prev.workspace,
					groups: {},
				}));

				setAllGitResources(allGitResourcesData);
				setHasLoadedAccessSettings(true);
			} catch (e) {
				const code = toGesErrorCode(e);
				setAccessTabsValue(setTabErrors, code);
			} finally {
				if (isInitial) setAccessTabsValue(setInitialLoading, false);
				else setAccessTabsValue(setRefreshing, false);
			}
		},
		[gesCloudApi, hasLoadedAccessSettings],
	);

	const ensureLoaded: SettingsContextType["ensureLoaded"] = useCallback(
		async (tab, force = false) => {
			if (accessTabs.includes(tab as (typeof accessTabs)[number])) {
				await loadAccessSettings(force);
			}
		},
		[loadAccessSettings],
	);

	useEffect(() => {
		void ensureLoaded("resources");
	}, [ensureLoaded]);

	const isInitialLoading = useCallback((tab: TabKey) => initialLoading[tab], [initialLoading]);
	const isRefreshing = useCallback((tab: TabKey) => refreshing[tab], [refreshing]);
	const getTabError = useCallback((tab: TabKey) => tabErrors[tab], [tabErrors]);

	const value = useMemo<SettingsContextType>(
		() => ({
			settings,
			global: { allGitResources },
			gesUrl,
			globalError: null,
			reloadGlobal: unsupported,
			ssoUsersEnabled: false,
			ssoGroupsEnabled: false,
			update: unsupported,
			addGroup: unsupported,
			deleteGroups: unsupported,
			renameGroup: unsupported,
			addResource,
			deleteResources,
			checkStyleGuide: unsupported,
			healthcheckStyleGuide: unsupported,
			healthcheckDataProvider: unsupported,
			searchUsers: unsupportedSso,
			searchUsersByEmails: unsupportedSso,
			searchGroups: unsupportedSso,
			searchGroupsByIds: unsupportedSso,
			searchBranches,
			getQuizUsersAnswers: unsupported,
			getQuizDetailedUserAnswers: unsupported,
			searchQuizTests: unsupported,
			searchAnsweredUsers: unsupported,
			getMetricsTableData: unsupported,
			loadFilteredChartData: unsupported,
			getMetricsUsers: unsupported,
			getMetricsCatalogs: unsupported,
			getSearchMetricsCatalogs: unsupported,
			ensureLoaded,
			getSearchTableData: unsupported,
			getSearchQueryDetails: unsupported,
			getArticleRatings: unsupported,
			getLicenseInfo: unsupported,
			isInitialLoading,
			isRefreshing,
			getTabError,
		}),
		[
			addResource,
			deleteResources,
			ensureLoaded,
			gesUrl,
			getTabError,
			isInitialLoading,
			isRefreshing,
			searchBranches,
			settings,
			allGitResources,
		],
	);

	return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
