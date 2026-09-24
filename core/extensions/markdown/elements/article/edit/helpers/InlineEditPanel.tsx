import InlineMenuGroup, { type InlineMenuGroupButtons } from "@ext/markdown/core/edit/components/Menu/Groups/Inline";
import ListMenuGroup, { type ListMenuGroupButtons } from "@ext/markdown/core/edit/components/Menu/Groups/List";
import type { TableMenuGroupButtons } from "@ext/markdown/core/edit/components/Menu/Groups/Table";
import TableMenuGroup from "@ext/markdown/core/edit/components/Menu/Groups/Table";
import TableAggregation from "@ext/markdown/core/edit/components/Menu/Groups/TableAggregation";
import TextMenuGroup, { type TextMenuGroupButtons } from "@ext/markdown/core/edit/components/Menu/Groups/Text";
import type { InlineToolbarOptions } from "@ext/markdown/elements/article/edit/helpers/InlineToolbar";
import type { Editor } from "@tiptap/core";
import { GlassToolbar, GlassToolbarSeparator } from "@ui-kit/GlassToolbar";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { memo } from "react";

export interface InlineToolbarButtons {
	tableGroup?: TableMenuGroupButtons & {
		aggregation?: boolean;
	};
	textGroup?: TextMenuGroupButtons;
	listGroup?: ListMenuGroupButtons;
	inlineGroup?: InlineMenuGroupButtons;
}

interface InlineEditPanelProps extends InlineToolbarOptions {
	editor: Editor;
	closeHandler?: () => void;
	buttons?: InlineToolbarButtons;
	className?: string;
}

const InlineEditPanel = memo((props: InlineEditPanelProps) => {
	const { editor, closeHandler, isInTable, isCellSelection, buttons, className } = props;
	const {
		tableGroup = { aggregation: true, mergeCells: true, splitCells: true, deleteRow: true, deleteColumn: true },
		textGroup = {},
		listGroup = {},
		inlineGroup = {},
	} = buttons || {};

	return (
		<ComponentVariantProvider variant="glass">
			{/* biome-ignore lint/a11y/useValidAriaRole: expected */}
			<GlassToolbar className={className} data-qa="qa-inline-wysiwyg-menu" role="article-inline-toolbar">
				{isInTable && tableGroup && (
					<>
						<TableMenuGroup buttons={tableGroup} editor={editor} onClick={closeHandler} />
						{tableGroup?.aggregation && <TableAggregation disabled={!isCellSelection} editor={editor} />}
						<GlassToolbarSeparator variant="inline" />
					</>
				)}
				<TextMenuGroup buttons={textGroup} editor={editor} isSelectionMenu />
				<ListMenuGroup buttons={listGroup} editor={editor} isSelectionMenu />
				{!isCellSelection && (
					<>
						<GlassToolbarSeparator variant="inline" />
						<InlineMenuGroup buttons={inlineGroup} editor={editor} onClick={closeHandler} />
					</>
				)}
			</GlassToolbar>
		</ComponentVariantProvider>
	);
});

export default InlineEditPanel;
