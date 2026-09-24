import { ArticlePropertyWrapper } from "@ext/properties/components/ArticlePropertyWrapper";
import AddProperty from "@ext/properties/components/Helpers/AddProperty";
import PropertyArticle from "@ext/properties/components/Helpers/PropertyArticle";
import PropertyComponent from "@ext/properties/components/Property";
import { filterPropertyList } from "@ext/properties/logic/utils/filterPropertyList";
import { type Property, PropertyTypes } from "@ext/properties/models";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@ui-kit/Dropdown";
import { useMemo } from "react";

export interface PropertiesProps {
	properties: Property[];
	catalogProperties: Map<string, Property>;
	trigger: JSX.Element;
	hideList?: boolean;
	isReadOnly?: boolean;
	isSubMenu?: boolean;
	onSubmit: (id: string, value: string) => void;
	onDelete?: (id: string) => void;
	collapseValues?: boolean;
}

type PropertyMenuProps = Pick<
	PropertiesProps,
	"catalogProperties" | "isReadOnly" | "isSubMenu" | "onDelete" | "onSubmit" | "properties" | "trigger"
>;

type PropertyListProps = Pick<
	PropertiesProps,
	"collapseValues" | "isReadOnly" | "onDelete" | "onSubmit" | "properties"
>;

export const PropertyMenu = ({
	properties,
	catalogProperties,
	isReadOnly,
	isSubMenu,
	onSubmit,
	onDelete,
	trigger,
}: PropertyMenuProps) => {
	if (isReadOnly) return null;

	const DropdownmenuComponent = isSubMenu ? DropdownMenuSub : DropdownMenu;
	const DropdownmenuContentComponent = isSubMenu ? DropdownMenuSubContent : DropdownMenuContent;
	const DropdownmenuTriggerComponent = isSubMenu ? DropdownMenuSubTrigger : DropdownMenuTrigger;

	return (
		<DropdownmenuComponent>
			<DropdownmenuTriggerComponent asChild={!isSubMenu}>{trigger}</DropdownmenuTriggerComponent>
			<DropdownmenuContentComponent style={{ maxWidth: "15rem", maxHeight: "max(45dvh, 30rem)" }}>
				<AddProperty
					canAdd
					catalogProperties={catalogProperties}
					onDelete={onDelete}
					onSubmit={onSubmit}
					properties={properties}
				/>
			</DropdownmenuContentComponent>
		</DropdownmenuComponent>
	);
};

export const PropertyList = ({ properties, isReadOnly, onSubmit, onDelete, collapseValues }: PropertyListProps) => {
	const articleRenderedProperties = useMemo(() => {
		return properties?.map((property) => {
			const button = (
				<PropertyComponent
					collapseValues={collapseValues}
					icon={property.icon}
					name={property.name}
					propertyStyle={property.style}
					shouldShowValue={property.type !== PropertyTypes.flag}
					type={property.type}
					value={property.value?.length && property.value[0]?.length ? property.value : property.name}
				/>
			);

			if (isReadOnly) {
				return (
					<div className="min-w-0 max-w-full" key={property.id}>
						{button}
					</div>
				);
			}

			return (
				<PropertyArticle
					key={property.id}
					onDelete={onDelete}
					onSubmit={onSubmit}
					property={property}
					trigger={<div className="min-w-0 max-w-full">{button}</div>}
				/>
			);
		});
	}, [properties, onSubmit, onDelete, isReadOnly, collapseValues]);

	return <ArticlePropertyWrapper className="mt-1">{articleRenderedProperties}</ArticlePropertyWrapper>;
};

const Properties = (props: PropertiesProps) => {
	const {
		properties,
		catalogProperties,
		hideList,
		isReadOnly,
		isSubMenu,
		onSubmit,
		onDelete,
		trigger,
		collapseValues,
	} = props;

	const filteredProperties = useMemo(() => {
		return isReadOnly ? properties.filter((property) => filterPropertyList(property, isReadOnly)) : properties;
	}, [properties, isReadOnly]);

	return (
		<>
			<PropertyMenu
				catalogProperties={catalogProperties}
				isReadOnly={isReadOnly}
				isSubMenu={isSubMenu}
				onDelete={onDelete}
				onSubmit={onSubmit}
				properties={properties}
				trigger={trigger}
			/>
			{!hideList && (
				<PropertyList
					collapseValues={collapseValues}
					isReadOnly={isReadOnly}
					onDelete={onDelete}
					onSubmit={onSubmit}
					properties={filteredProperties}
				/>
			)}
		</>
	);
};

export default Properties;
