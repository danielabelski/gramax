import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import { getEditorStore, setEditorStore } from "@core-ui/stores/EditorStore";
import t from "@ext/localization/locale/translate";
import { HIGHLIGHT_COLOR_NAMES } from "@ext/markdown/elements/highlight/edit/model/consts";
import type { Editor } from "@tiptap/core";
import { ColorTile } from "@ui-kit/ColorTile";
import {
	GlassToolbar,
	GlassToolbarGroup,
	GlassToolbarIcon,
	GlassToolbarToggleButton,
	GlassToolbarTriggerChevron,
} from "@ui-kit/GlassToolbar";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-kit/Popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type MouseEvent, memo, useCallback, useRef } from "react";
import { tv } from "tailwind-variants";

const colorTileStyles = tv({
	variants: {
		color: {
			yellow: "bg-[var(--color-highlight-yellow)]",
			green: "bg-[var(--color-highlight-green)]",
			purple: "bg-[var(--color-highlight-purple)]",
			blue: "bg-[var(--color-highlight-blue)]",
			orange: "bg-[var(--color-highlight-orange)]",
			red: "bg-[var(--color-highlight-red)]",
		},
	},
});

const markerStyles = tv({
	base: "text-inverse-primary-fg",
	variants: {
		color: {
			yellow: "[&>svg>path:first-child]:fill-[var(--color-highlight-yellow)]",
			green: "[&>svg>path:first-child]:fill-[var(--color-highlight-green)]",
			purple: "[&>svg>path:first-child]:fill-[var(--color-highlight-purple)]",
			blue: "[&>svg>path:first-child]:fill-[var(--color-highlight-blue)]",
			orange: "[&>svg>path:first-child]:fill-[var(--color-highlight-orange)]",
			red: "[&>svg>path:first-child]:fill-[var(--color-highlight-red)]",
		},
	},
});

const HighlightMenuButton = ({ editor }: { editor: Editor }) => {
	const { isActive: active, disabled, attrs } = ButtonStateService.useCurrentAction({ mark: "highlight" });
	const lastUsedColor = getEditorStore().lastUsedHighlightColor ?? HIGHLIGHT_COLOR_NAMES.YELLOW;
	const portalContainerRef = useRef<HTMLDivElement>(null);
	const isActive = active;

	const onClickHandler = useCallback(
		(event: MouseEvent<HTMLDivElement>, color: HIGHLIGHT_COLOR_NAMES) => {
			event.preventDefault();
			setEditorStore({ lastUsedHighlightColor: color });
			editor.commands.setHighlight({ color });
		},
		[editor],
	);

	const onTriggerClick = useCallback(() => {
		if (isActive) {
			editor.commands.unsetHighlight();
			return;
		}

		const color = lastUsedColor ?? HIGHLIGHT_COLOR_NAMES.YELLOW;
		editor.commands.setHighlight({ color });
	}, [isActive, editor, lastUsedColor]);

	const onAutoCloseFocus = useCallback(
		(event: Event) => {
			event.preventDefault();
			editor.commands.focus();
		},
		[editor],
	);

	return (
		<GlassToolbarGroup>
			<GlassToolbarToggleButton
				active={isActive}
				className={markerStyles({ color: attrs?.color || lastUsedColor })}
				disabled={disabled}
				onClick={onTriggerClick}
			>
				<GlassToolbarIcon icon="color-highlighter" />
			</GlassToolbarToggleButton>
			<Popover>
				<PopoverTrigger asChild>
					<GlassToolbarTriggerChevron disabled={disabled} focusable sub />
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="bg-transparent p-0 w-auto overflow-visible !shadow-none border-none"
					onCloseAutoFocus={onAutoCloseFocus}
					portalContainer={portalContainerRef.current}
					side="top"
					sideOffset={8}
				>
					<GlassToolbar>
						{Object.values(HIGHLIGHT_COLOR_NAMES).map((color) => (
							<Tooltip key={color}>
								<TooltipTrigger asChild>
									<div className="[&>div:last-of-type]:border-inverse-secondary-fg">
										<ColorTile
											className={colorTileStyles({ color })}
											onClick={(event) => onClickHandler(event, color)}
											selected={isActive && attrs?.color === color}
										/>
									</div>
								</TooltipTrigger>
								<TooltipContent>{t(`editor.highlight.colors.${color}`)}</TooltipContent>
							</Tooltip>
						))}
					</GlassToolbar>
				</PopoverContent>
			</Popover>
		</GlassToolbarGroup>
	);
};

export default memo(HighlightMenuButton);
