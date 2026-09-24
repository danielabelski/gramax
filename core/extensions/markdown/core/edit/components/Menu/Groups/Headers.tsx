import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import { getEditorStore, setEditorStore } from "@core-ui/stores/EditorStore";
import t from "@ext/localization/locale/translate";
import HeadingMenuButton from "@ext/markdown/elements/heading/edit/components/HeadingMenuButton";
import type { Level } from "@ext/markdown/elements/heading/edit/model/heading";
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
import { GlassToolbarGroup, GlassToolbarToggleGroup, GlassToolbarTriggerChevron } from "@ui-kit/GlassToolbar";
import { Icon } from "@ui-kit/Icon";
import { useCallback } from "react";

const HeadersMenuGroup = ({ editor }: { editor?: Editor }) => {
	const { disabled, isActive, attrs } = ButtonStateService.useCurrentAction({
		action: "heading",
	});

	const onSelectHeading = useCallback(
		(value: string) => {
			if (!editor) return;
			const level = Number(value) as Level;
			editor.chain().focus().toggleHeading({ level }).run();
			setEditorStore({ lastUsedHeadingLevel: level });
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

	const lastUsedHeadingLevel = isActive ? attrs?.level : getEditorStore().lastUsedHeadingLevel || 2;
	const lastUsedHeadingLevelString = lastUsedHeadingLevel?.toString();

	return (
		<GlassToolbarGroup>
			<GlassToolbarToggleGroup
				defaultValue={lastUsedHeadingLevelString}
				disabled={disabled}
				type="single"
				value={lastUsedHeadingLevelString}
			>
				<HeadingMenuButton editor={editor} level={lastUsedHeadingLevel} />
			</GlassToolbarToggleGroup>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<GlassToolbarTriggerChevron data-testid="tb-headers" disabled={disabled} sub />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" onCloseAutoFocus={onCloseAutoFocus} side="top" sideOffset={8}>
					<DropdownMenuLabel>{t("editor.heading")}</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						indicatorIconPosition="start"
						onValueChange={onSelectHeading}
						value={lastUsedHeadingLevelString}
					>
						{[2, 3, 4].map((level) => (
							<DropdownMenuRadioItem data-heading-level={level} key={level} value={level.toString()}>
								<Icon icon={`heading-${level}-custom` as IconCode} />
								{t("editor.heading")} {level} <DropdownMenuShortcut value={`Mod-Alt-${level}`} />
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</GlassToolbarGroup>
	);
};

export default HeadersMenuGroup;
