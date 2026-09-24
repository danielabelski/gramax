import t from "@ext/localization/locale/translate";
import { hasActiveSort } from "@ext/markdown/elements/table/edit/logic/sortAndFilter/hasActiveSort";
import type { Editor } from "@tiptap/core";
import { GlassToolbarGroup, GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { useCallback } from "react";

export interface TableMenuGroupButtons {
	mergeCells?: boolean;
	splitCells?: boolean;
	deleteRow?: boolean;
	deleteColumn?: boolean;
}

interface TableMenuGroupProps {
	editor?: Editor;
	onClick?: () => void;
	buttons?: TableMenuGroupButtons;
}

const TableMenuGroup = ({ editor, onClick, buttons }: TableMenuGroupProps) => {
	const { mergeCells = true, splitCells = true, deleteRow = true, deleteColumn = true } = buttons || {};
	const canMergeCells = editor && mergeCells && editor.can().mergeCells();
	const canSplitCells = editor && splitCells && editor.can().splitCell();
	const canDeleteRow = editor && deleteRow && editor.can().deleteRow();
	const canDeleteColumn = editor && deleteColumn && editor.can().deleteColumn();
	const isSorted = hasActiveSort(editor.state.selection);

	const onMergeCells = useCallback(() => {
		editor.chain().focus().mergeCells().run();
		onClick();
	}, [editor, onClick]);

	const onSplitCells = useCallback(() => {
		editor.chain().focus().splitCell().run();
		onClick();
	}, [editor, onClick]);

	const onDeleteRow = useCallback(() => {
		editor.chain().focus().deleteRow().run();
		onClick();
	}, [editor, onClick]);

	const onDeleteColumn = useCallback(() => {
		editor.chain().focus().deleteColumn().run();
		onClick();
	}, [editor, onClick]);

	if (!canMergeCells && !canSplitCells && !canDeleteRow && !canDeleteColumn) return null;

	return (
		<GlassToolbarGroup>
			{canMergeCells && (
				<GlassToolbarToggleButton
					disabled={isSorted}
					onClick={onMergeCells}
					tooltipText={t(`editor.table.join-cells.${isSorted ? "sorted" : "action"}`)}
				>
					<GlassToolbarIcon icon="merge-cells" />
				</GlassToolbarToggleButton>
			)}
			{canSplitCells && (
				<GlassToolbarToggleButton onClick={onSplitCells} tooltipText={t("editor.table.split-cells")}>
					<GlassToolbarIcon icon="split-cells" />
				</GlassToolbarToggleButton>
			)}
			{canDeleteRow && (
				<GlassToolbarToggleButton onClick={onDeleteRow} tooltipText={t("editor.table.row.delete")}>
					<GlassToolbarIcon icon="delete-row" />
				</GlassToolbarToggleButton>
			)}
			{canDeleteColumn && (
				<GlassToolbarToggleButton onClick={onDeleteColumn} tooltipText={t("editor.table.column.delete")}>
					<GlassToolbarIcon icon="delete-column" />
				</GlassToolbarToggleButton>
			)}
		</GlassToolbarGroup>
	);
};

export default TableMenuGroup;
