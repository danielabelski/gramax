import { createContext, type RefObject, useContext } from "react";

interface OrgSettingsHeaderContextValue {
	headerRef: RefObject<HTMLElement>;
}

const OrgSettingsHeaderContext = createContext<OrgSettingsHeaderContextValue | null>(null);

export const OrgSettingsHeaderProvider = OrgSettingsHeaderContext.Provider;

export const useOrgSettingsHeader = () => {
	return useContext(OrgSettingsHeaderContext);
};
