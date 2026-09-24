import useShouldRenderDeleteCatalog from "@components/Actions/useShouldRenderDeleteCatalog";
import type { LeftNavigationTab } from "@components/Layouts/LeftNavigationTabs/LeftNavigationTab";
import NavigationTabsService from "@components/Layouts/LeftNavigationTabs/NavigationTabsService";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import useWatch from "@core-ui/hooks/useWatch";
import { useItemLinks } from "@core-ui/stores/ItemLinksStore/ItemLinksStore.provider";
import t from "@ext/localization/locale/translate";
import useValidateDeleteCatalogInStatic from "@ext/static/logic/useValidateDeleteCatalogInStatic";
import { applyMenuModifiers } from "@plugins/store";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTriggerButton } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { type FC, Fragment, type ReactNode, useEffect, useState } from "react";
import { buildCatalogMenu, type MenuItemDescriptorApp } from "./buildCatalogMenu";
import { CatalogActionsProvider, useCatalogActionsContext } from "./CatalogActionsContext";

interface CatalogActionsProps {
	isCatalogExist: boolean;
	currentTab: LeftNavigationTab;
}

// biome-ignore lint/suspicious/noExplicitAny: idc
type RenderPropsFunction = (props: any) => ReactNode;
type MenuChildrenContent = ReactNode | RenderPropsFunction | undefined;

const renderMenuItems = (items: MenuItemDescriptorApp[]): ReactNode => {
	return items
		.filter((item) => item.visible)
		.map((item) => {
			let childrenContent: MenuChildrenContent;

			if (item.children?.length) {
				childrenContent = (props) => {
					const childItems = item.children.map((child) => ({
						...child,
						component: () => (child.component as RenderPropsFunction)(props),
					}));
					return renderMenuItems(childItems);
				};
			}

			const component = item.component as RenderPropsFunction;
			const content = component(childrenContent);

			return <Fragment key={item.id}>{content}</Fragment>;
		});
};

const CatalogActionsMenu: FC = () => {
	const ctx = useCatalogActionsContext();
	const [menuItems, setMenuItems] = useState<MenuItemDescriptorApp[]>([]);

	useWatch(() => {
		const applyModifiers = async () => {
			const baseItems = buildCatalogMenu(ctx);
			const modifiedItems = await applyMenuModifiers(baseItems, ctx.pluginContext);
			setMenuItems(modifiedItems);
		};
		void applyModifiers();
	}, [ctx.pluginContext, ctx.isAgentAvailable, ctx.renderDeleteCatalog]);

	return renderMenuItems(menuItems);
};

const CatalogActions: FC<CatalogActionsProps> = ({ isCatalogExist, currentTab }) => {
	const shouldRenderDeleteCatalog = useShouldRenderDeleteCatalog();
	const [renderDeleteCatalog, setRenderDeleteCatalog] = useState(false);
	const validateDeleteCatalogInStatic = useValidateDeleteCatalogInStatic();
	const { isStatic } = usePlatform();
	const itemLinks = useItemLinks();

	useEffect(() => {
		setRenderDeleteCatalog(isStatic ? false : shouldRenderDeleteCatalog);
	}, [isStatic, shouldRenderDeleteCatalog]);

	if (!isCatalogExist) return null;

	const handleOpenChange = async (open: boolean) => {
		if (!open || !shouldRenderDeleteCatalog || !isStatic) return;
		setRenderDeleteCatalog(await validateDeleteCatalogInStatic());
	};

	const setCurrentTab = (tab: LeftNavigationTab) => {
		NavigationTabsService.setTop(tab);
	};

	return (
		<CatalogActionsProvider
			currentTab={currentTab}
			itemLinks={itemLinks}
			renderDeleteCatalog={renderDeleteCatalog}
			setCurrentTab={setCurrentTab}
		>
			<ComponentVariantProvider variant="glass">
				<DropdownMenu modal={false} onOpenChange={handleOpenChange}>
					<DropdownMenuTriggerButton
						className="aspect-square shrink-0 p-0"
						data-qa="qa-catalog-actions"
						data-testid="catalog-actions"
						size="sm"
						tooltip={t("catalog.actions.title")}
						variant="ghost"
					>
						<Icon className="size-4" icon="ellipsis" />
					</DropdownMenuTriggerButton>
					<DropdownMenuContent align="start" side="right">
						<CatalogActionsMenu />
					</DropdownMenuContent>
				</DropdownMenu>
			</ComponentVariantProvider>
		</CatalogActionsProvider>
	);
};

export default CatalogActions;
