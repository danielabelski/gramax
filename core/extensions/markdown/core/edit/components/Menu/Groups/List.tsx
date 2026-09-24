import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import { getEditorStore, setEditorStore } from "@core-ui/stores/EditorStore";
import t, { type TranslationKey } from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@ui-kit/Dropdown";
import {
	GlassToolbarGroup,
	GlassToolbarIcon,
	GlassToolbarSeparator,
	GlassToolbarToggleButton,
	GlassToolbarTriggerChevron,
} from "@ui-kit/GlassToolbar";
import { useCallback, useMemo } from "react";

type ListType = "bullet" | "ordered" | "task";

const listTypes: Record<
	ListType,
	{ icon: IconCode; hotKey: string; label: TranslationKey; toggle: (editor: Editor) => void }
> = {
	bullet: {
		icon: "list",
		hotKey: "Mod-Shift-8",
		label: "editor.bullet-list",
		toggle: (editor) => editor.chain().focus().toggleBulletList().run(),
	},
	ordered: {
		icon: "list-ordered",
		hotKey: "Mod-Shift-7",
		label: "editor.ordered-list",
		toggle: (editor) => editor.chain().focus().toggleOrderedList().run(),
	},
	task: {
		icon: "list-todo",
		hotKey: "Mod-Shift-9",
		label: "editor.task-list",
		toggle: (editor) => editor.chain().focus().toggleTaskList().run(),
	},
};

export interface ListMenuGroupButtons {
	bulletList?: boolean;
	orderedList?: boolean;
	taskList?: boolean;
}

interface ListMenuGroupProps {
	editor?: Editor;
	isSelectionMenu?: boolean;
	buttons?: ListMenuGroupButtons;
}

const ListMenuGroup = ({ editor, isSelectionMenu = false, buttons }: ListMenuGroupProps) => {
	const { bulletList = true, orderedList = true, taskList = true } = buttons || {};

	const bulletListState = ButtonStateService.useCurrentAction({ action: "bulletList" });
	const orderedListState = ButtonStateService.useCurrentAction({ action: "orderedList" });
	const taskListState = ButtonStateService.useCurrentAction({ action: "taskList" });

	const states = { bullet: bulletListState, ordered: orderedListState, task: taskListState };
	const shown: Record<ListType, boolean> = { bullet: bulletList, ordered: orderedList, task: taskList };

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	const value = useMemo((): ListType => {
		if (editor?.isActive("bulletList")) return "bullet";
		if (editor?.isActive("orderedList")) return "ordered";
		if (editor?.isActive("taskList")) return "task";
		return getEditorStore().lastUsedListType || "bullet";
	}, [editor?.state.selection]);

	const onSelectList = useCallback(
		(type: string) => {
			if (!editor) return;
			const listType = type as ListType;
			listTypes[listType].toggle(editor);
			setEditorStore({ lastUsedListType: listType });
		},
		[editor],
	);

	const onCloseAutoFocus = useCallback(
		(event: Event) => {
			event.preventDefault();
			editor?.commands.focus();
		},
		[editor],
	);

	const disabled = bulletListState.disabled && orderedListState.disabled && taskListState.disabled;
	const { icon, hotKey, label } = listTypes[value];

	return (
		<>
			{(bulletList || orderedList || taskList) && (
				<GlassToolbarSeparator variant={isSelectionMenu ? "inline" : "bottom"} />
			)}
			<GlassToolbarGroup>
				<GlassToolbarToggleButton
					active={states[value].isActive}
					data-testid={`tb-${value}-list`}
					disabled={disabled}
					hotKey={hotKey}
					onClick={() => onSelectList(value)}
					tooltipText={t(label)}
				>
					<GlassToolbarIcon icon={icon} />
				</GlassToolbarToggleButton>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<GlassToolbarTriggerChevron data-testid="tb-lists" disabled={disabled} sub />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" onCloseAutoFocus={onCloseAutoFocus} side="top" sideOffset={8}>
						<DropdownMenuLabel>{t("editor.lists")}</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							indicatorIconPosition="start"
							onValueChange={onSelectList}
							value={value}
						>
							{Object.entries(listTypes).map(
								([type, item]) =>
									shown[type as ListType] && (
										<DropdownMenuRadioItem
											data-list-type={type}
											disabled={states[type as ListType].disabled}
											key={type}
											value={type}
										>
											<GlassToolbarIcon icon={item.icon} />
											{t(item.label)}
											<DropdownMenuShortcut className="ml-auto" value={item.hotKey} />
										</DropdownMenuRadioItem>
									),
							)}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</GlassToolbarGroup>
		</>
	);
};

export default ListMenuGroup;
