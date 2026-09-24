import PageDataContextService from "@core-ui/ContextServices/PageDataContext";

export function useIsEnterprise(): boolean {
	const { activeGesUrl, enterprise } = PageDataContextService.value.conf;
	return Boolean(enterprise.gesUrl || (activeGesUrl && activeGesUrl === enterprise.gesUrl));
}
