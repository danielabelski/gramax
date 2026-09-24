import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import { readyToPlace } from "@ext/markdown/elementsUtils/cursorFunctions";
import { BlockPlusAndSubNodes, ListGroupAndItem } from "@ext/markdown/logic/insertableNodeGroups";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";

const TableMenuButton = ({ editor }: { editor: Editor }) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ action: "table" });

	return (
		<GlassToolbarToggleButton
			active={isActive}
			data-testid="tb-table"
			disabled={isActive ? true : disabled}
			onClick={() => {
				if (!readyToPlace(editor.state, "table", [...BlockPlusAndSubNodes, ...ListGroupAndItem, "heading"]))
					return false;

				editor
					.chain()
					.insertTable({ rows: 3, cols: 3, withHeaderRow: false })
					.focus(editor.state.selection.anchor + 3)
					.run();
			}}
			tooltipText={t("editor.table.name")}
		>
			<GlassToolbarIcon icon="table" />
		</GlassToolbarToggleButton>
	);
};

export default TableMenuButton;
