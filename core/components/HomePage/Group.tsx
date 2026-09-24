import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import GroupHeader from "./sections/GroupHeader";
import GroupItems from "./sections/GroupItems";
import type { RenameState, SectionDragHandleProps, SectionEditActions } from "./sections/sectionTypes";
import type { HomeItem } from "./utils/homeLayoutTypes";

interface GroupProps {
	catalogLinks: CatalogLink[];
	title?: string;
	containerKey?: string;
	items?: HomeItem[];
	dragHandleProps?: SectionDragHandleProps;
	editActions?: SectionEditActions;
	renameState?: RenameState;
}

const Group = ({ title, catalogLinks, containerKey, items, dragHandleProps, editActions, renameState }: GroupProps) => {
	// the uncategorized section has neither a title nor anything to do with itself: its label is the divider above it
	const hasHeader = Boolean(title || editActions);

	return (
		<div className="flex flex-col gap-6">
			{hasHeader && (
				<GroupHeader
					dragHandleProps={dragHandleProps}
					editActions={editActions}
					renameState={renameState}
					title={title}
				/>
			)}
			<div className="flex flex-col group-container">
				<GroupItems catalogLinks={catalogLinks} containerKey={containerKey} items={items} />
			</div>
		</div>
	);
};

export default Group;
