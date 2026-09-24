import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import assert from "assert";
import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext } from "react";
import type { HomeFolder } from "./utils/homeLayoutTypes";

export interface HomeGroupContextValue {
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	editMode?: boolean;
	linkByName?: Record<string, CatalogLink>;
	layoutAnimationTick?: number;
	overTargetId?: string;
	onConvertFolderToSection?: (folderId: string) => void;
	onDeleteFolder?: (folderId: string) => void;
	onOpenFolder?: (folder: HomeFolder) => void;
	onRenameFolder?: (folderId: string, title: string) => void;
}

const HomeGroupContext = createContext<HomeGroupContextValue | null>(null);

export const useHomeGroup = (): HomeGroupContextValue => {
	const context = useContext(HomeGroupContext);
	assert(context, "useHomeGroup must be used within HomeGroupProvider");

	return context;
};

interface HomeGroupProviderProps {
	children: ReactNode;
	value: HomeGroupContextValue;
}

export const HomeGroupProvider = ({ children, value }: HomeGroupProviderProps) => (
	<HomeGroupContext.Provider value={value}>{children}</HomeGroupContext.Provider>
);
