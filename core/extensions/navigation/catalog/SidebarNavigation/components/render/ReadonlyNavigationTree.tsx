import { useNavTreePersistence } from "@core/SitePresenter/NavTreeStateManager";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { cn } from "@core-ui/utils/cn";
import {
	NavigationTreeStoreProvider,
	useNavigationTreeStore,
	useNavigationTreeStoreApi,
} from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { SidebarGroup } from "@ui-kit/Sidebar";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { VirtualNavigationTree } from "../Helpers/VirtualNavigationTree";
import { ReadonlyNavigationTreeItem } from "./ReadonlyNavigationTreeItem";

export const ReadonlyNavigationTree = ({ items, beforeGroups }: { items: ItemLink[]; beforeGroups?: ReactNode }) => {
	const catalogName = useCatalogPropsStore((state) => state.data?.name);
	const supportedLanguages = useCatalogPropsStore((state) => state.data?.supportedLanguages, "shallow");
	const treeScope = `${catalogName ?? ""}:${PageDataContextService.value.language.content ?? ""}`;

	const { effectiveItems, toggle } = useNavTreePersistence(catalogName, items, supportedLanguages);

	return (
		<NavigationTreeStoreProvider initialLinks={effectiveItems} scope={treeScope}>
			<ReadonlyNavigationTreeContent
				beforeGroups={beforeGroups}
				effectiveItems={effectiveItems}
				toggle={toggle}
				treeScope={treeScope}
			/>
		</NavigationTreeStoreProvider>
	);
};

const ReadonlyNavigationTreeContent = ({
	beforeGroups,
	effectiveItems,
	treeScope,
	toggle,
}: {
	beforeGroups?: ReactNode;
	effectiveItems: ItemLink[];
	treeScope: string;
	toggle: (path: string, open: boolean) => void;
}) => {
	const [isTreeStateApplied, setIsTreeStateApplied] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const treeStore = useNavigationTreeStoreApi();
	const { setNavItems, setOnDrop, setOnToggle, flatIndex, rootIds } = useNavigationTreeStore((s) => ({
		setNavItems: s.setNavItems,
		setOnDrop: s.setOnDrop,
		setOnToggle: s.setOnToggle,
		flatIndex: s.flatIndex,
		rootIds: s.rootIds,
	}));

	useLayoutEffect(() => {
		setNavItems(effectiveItems, treeScope);
		setIsTreeStateApplied(true);
	}, [effectiveItems, setNavItems, treeScope]);

	useEffect(() => {
		setOnDrop(null);
	}, [setOnDrop]);

	useEffect(() => {
		setOnToggle((id, open) => {
			const path = treeStore.getState().flatIndex[id]?.ref?.path;
			if (!path) return;
			toggle(path, open);
		});
		return () => setOnToggle(null);
	}, [toggle, setOnToggle, treeStore]);

	return (
		<div
			className={cn(
				"relative mt-4 flex flex-col gap-3 [&_li]:mb-0 [&_li]:list-none",
				!isTreeStateApplied && "[&_[data-navigation-children]]:hidden",
			)}
			ref={containerRef}
		>
			{beforeGroups}
			{isTreeStateApplied ? (
				<VirtualNavigationTree containerRef={containerRef}>
					{({ id, level }) => <ReadonlyNavigationTreeItem id={id} level={level} virtualized />}
				</VirtualNavigationTree>
			) : (
				rootIds.map((groupId) => {
					const groupData = flatIndex[groupId];
					if (!groupData) return null;

					return (
						<SidebarGroup className="mt-0.5 px-2.5 py-0" key={groupId}>
							<ReadonlyNavigationTreeItem id={groupId} level={1} />
						</SidebarGroup>
					);
				})
			)}
		</div>
	);
};
