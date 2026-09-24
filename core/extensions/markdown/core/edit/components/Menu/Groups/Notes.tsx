import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import { getEditorStore, setEditorStore } from "@core-ui/stores/EditorStore";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import getIconColor from "@ext/markdown/elements/note/edit/logic/getNoteButtonIconColor";
import { NoteType, noteIcons } from "@ext/markdown/elements/note/render/component/Note";
import type { Editor } from "@tiptap/core";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@ui-kit/Dropdown";
import {
	GlassToolbarGroup,
	GlassToolbarIcon,
	GlassToolbarToggleButton,
	GlassToolbarTriggerChevron,
} from "@ui-kit/GlassToolbar";
import { Icon } from "@ui-kit/Icon";
import { useCallback } from "react";

const noteTypes = Object.values(NoteType).filter((type) => type !== NoteType.hotfixes);

const NotesMenuGroup = ({ editor }: { editor?: Editor }) => {
	const note = ButtonStateService.useCurrentAction({ action: "note" });
	const lastUsedNoteType: Exclude<NoteType, "hotfixes"> =
		editor?.getAttributes("note")?.type || getEditorStore().lastUsedNoteType || NoteType.info;

	const onSelectNote = useCallback(
		(value: string) => {
			const noteType = value as Exclude<NoteType, "hotfixes">;
			editor?.chain().focus().toggleNote(noteType).run();
			setEditorStore({ lastUsedNoteType: noteType });
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

	return (
		<GlassToolbarGroup>
			<GlassToolbarToggleButton
				active={note.isActive}
				data-testid="tb-note"
				disabled={note.disabled}
				onClick={() => onSelectNote(lastUsedNoteType)}
				tooltipText={t(`${lastUsedNoteType}-text`)}
			>
				<GlassToolbarIcon
					className={cn(lastUsedNoteType === NoteType.quote && "transform scale(1, -1)")}
					data-type={NoteType.quote}
					icon={noteIcons[lastUsedNoteType] as IconCode}
				/>
			</GlassToolbarToggleButton>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<GlassToolbarTriggerChevron data-testid="tb-notes" disabled={note.disabled} sub />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" onCloseAutoFocus={onCloseAutoFocus} side="top" sideOffset={8}>
					<DropdownMenuLabel>{t("editor.notes")}</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						indicatorIconPosition="start"
						onValueChange={onSelectNote}
						value={lastUsedNoteType}
					>
						{noteTypes.map((noteType) => (
							<DropdownMenuRadioItem disabled={note.disabled} key={noteType} value={noteType}>
								<div className="flex flex-row items-center gap-2 mr-3">
									<Icon color={getIconColor(noteType)} icon={noteIcons[noteType] as IconCode} />
									<span>{t(`${noteType}-text`)}</span>
								</div>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</GlassToolbarGroup>
	);
};

export default NotesMenuGroup;
