import {
	LinksSectionContent,
	useLinksSectionData,
} from "@components/Layouts/CatalogLayout/RightNavigation/sections/LinksSection";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { CatalogView } from "@ext/catalog/views/components/CatalogView";
import t from "@ext/localization/locale/translate";
import TableOfContents from "@ext/navigation/article/render/TableOfContents";
import SwitchVersion from "@ext/versioning/components/SwitchVersion";
import { GlassToolbarIcon, type GlassToolbarIconProps, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-kit/Popover";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type ReactNode, useState } from "react";
import { CollapsedNavigationTrigger } from "./CollapsedNavigationTrigger";
import { ArticlePropertiesSectionContent, useArticlePropertiesSectionData } from "./sections/ArticlePropertiesSection";

const POPOVER_CLASS = "flex max-h-[60vh] w-64 flex-col";

interface CollapsedPopoverProps {
	icon: GlassToolbarIconProps["icon"];
	tooltip: string;
	children: ReactNode;
	testId?: string;
}

const CollapsedPopover = ({ icon, tooltip, children, testId }: CollapsedPopoverProps) => {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover onOpenChange={setIsOpen} open={isOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<GlassToolbarToggleButton active={isOpen} aria-label={tooltip} data-testid={testId} focusable>
							<GlassToolbarIcon icon={icon} />
						</GlassToolbarToggleButton>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent focus="high">{tooltip}</TooltipContent>
			</Tooltip>
			<PopoverContent align="end" className={POPOVER_CLASS}>
				{children}
			</PopoverContent>
		</Popover>
	);
};

export const CollapsedRightNavigation = () => {
	const linksSectionData = useLinksSectionData();
	const { errorCode, tocItems } = useArticlePropsStore(
		(state) => ({ errorCode: state.data?.errorCode, tocItems: state.data?.tocItems }),
		"shallow",
	);
	const { hasContent: hasProperties, ...propertiesData } = useArticlePropertiesSectionData();
	const showTableOfContents = errorCode !== 500 && !!tocItems?.length;
	const showArticleActions = errorCode !== 500 && hasProperties;

	return (
		<ComponentVariantProvider variant="glass">
			<Tooltip>
				<CatalogView
					trigger={
						<TooltipTrigger asChild>
							<CollapsedNavigationTrigger icon="layout-grid" label={t("catalog.views.trigger")} />
						</TooltipTrigger>
					}
				/>
				<TooltipContent focus="high">{t("catalog.views.trigger")}</TooltipContent>
			</Tooltip>
			{showTableOfContents && (
				<CollapsedPopover icon="list" tooltip={t("in-article")}>
					<TableOfContents className="min-h-0 overflow-y-auto px-2.5" />
				</CollapsedPopover>
			)}
			<Tooltip>
				<SwitchVersion
					trigger={
						<TooltipTrigger asChild>
							<CollapsedNavigationTrigger icon="layers" label={t("versions.switch")} />
						</TooltipTrigger>
					}
				/>
				<TooltipContent focus="high">{t("versions.switch")}</TooltipContent>
			</Tooltip>
			{showArticleActions && (
				<CollapsedPopover
					icon="list-plus"
					testId="catalog-properties-section-trigger"
					tooltip={t("properties.name")}
				>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<ArticlePropertiesSectionContent {...propertiesData} className="px-1" />
					</div>
				</CollapsedPopover>
			)}
			{linksSectionData.hasContent && (
				<CollapsedPopover icon="ellipsis" tooltip={t("actions")}>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<LinksSectionContent data={linksSectionData} />
					</div>
				</CollapsedPopover>
			)}
		</ComponentVariantProvider>
	);
};
