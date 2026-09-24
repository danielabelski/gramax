import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { useItemLinks } from "@core-ui/stores/ItemLinksStore/ItemLinksStore.provider";
import { cn } from "@core-ui/utils/cn";
import getArticleItemLink from "@ext/article/LinkCreator/logic/getArticleItemLink";
import t from "@ext/localization/locale/translate";
import { GroupHeader } from "@ext/navigation/article/render/GroupHeader";
import { PropertyList, PropertyMenu } from "@ext/properties/components/Helpers/Properties";
import PropertyServiceProvider from "@ext/properties/components/PropertyService";
import combineProperties from "@ext/properties/logic/combineProperties";
import { useUpdateArticleProperty } from "@ext/properties/logic/hooks/useUpdateArticleProperty";
import { filterPropertyList } from "@ext/properties/logic/utils/filterPropertyList";
import type { Property } from "@ext/properties/models";
import { IconButton } from "@ui-kit/Button";
import { Icon } from "@ui-kit/Icon";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { useMemo } from "react";

interface ArticlePropertiesSectionContentProps {
	properties: Property[];
	catalogProperties: Map<string, Property>;
	isReadOnly: boolean;
	onSubmit: (id: string, value: string) => void;
	onDelete: (id: string) => void;
	className?: string;
}

export const ArticlePropertiesSectionContent = ({
	properties,
	catalogProperties,
	isReadOnly,
	onSubmit,
	onDelete,
	className,
}: ArticlePropertiesSectionContentProps) => (
	<section className={cn("relative px-3", className)}>
		<GroupHeader className="flex items-center gap-2 px-0">
			<Icon className="size-4 opacity-70 shrink-0" icon="rectangle-ellipsis" />
			<span className="opacity-70 uppercase">{t("properties.name")}</span>
			<PropertyMenu
				catalogProperties={catalogProperties}
				isReadOnly={isReadOnly}
				onDelete={onDelete}
				onSubmit={onSubmit}
				properties={properties}
				trigger={
					<IconButton
						aria-label={t("properties.add")}
						className="ml-auto h-7"
						data-testid="catalog-properties"
						icon="plus"
						iconClassName="shrink-0"
						variant="text"
					/>
				}
			/>
		</GroupHeader>
		<PropertyList
			collapseValues
			isReadOnly={isReadOnly}
			onDelete={onDelete}
			onSubmit={onSubmit}
			properties={properties}
		/>
	</section>
);

interface ArticlePropertiesSectionData {
	properties: Property[];
	catalogProperties: Map<string, Property>;
	isReadOnly: boolean;
	onSubmit: (id: string, value: string) => void;
	onDelete: (id: string) => void;
	hasContent: boolean;
}

export const useArticlePropertiesSectionData = (): ArticlePropertiesSectionData => {
	const { articleProperties, setArticleProperties, properties } = PropertyServiceProvider.value;
	const itemLinks = useItemLinks();
	const articlePath = useArticlePropsStore((state) => state.data?.ref?.path);
	const isCatalogReadOnly = PageDataContextService.value?.conf.isReadOnly;
	const itemLink = articlePath ? getArticleItemLink(itemLinks, articlePath) : null;
	const { onSubmit, onDelete } = useUpdateArticleProperty({
		properties: articleProperties,
		setProperties: setArticleProperties,
	});
	const isReadOnly = isCatalogReadOnly || !itemLink;

	const filteredProperties = useMemo(() => {
		return combineProperties(articleProperties, properties).filter((property) =>
			filterPropertyList(property, isReadOnly),
		);
	}, [articleProperties, isReadOnly, properties]);

	return {
		properties: filteredProperties,
		catalogProperties: properties,
		isReadOnly,
		onSubmit,
		onDelete,
		hasContent: !isReadOnly || !!filteredProperties.length,
	};
};

export const ArticlePropertiesSection = () => {
	const { hasContent, ...data } = useArticlePropertiesSectionData();

	if (!hasContent) return null;

	return (
		<ComponentVariantProvider variant="glass">
			<ArticlePropertiesSectionContent {...data} />
		</ComponentVariantProvider>
	);
};
