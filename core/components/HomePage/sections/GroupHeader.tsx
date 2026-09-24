import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { IconButton } from "@ui-kit/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useRef, useState } from "react";
import { normalizeTitle } from "../utils/normalizeTitle";
import type { RenameState, SectionDragHandleProps, SectionEditActions } from "./sectionTypes";

interface GroupHeaderProps {
	title?: string;
	dragHandleProps?: SectionDragHandleProps;
	editActions?: SectionEditActions;
	renameState?: RenameState;
}

/** `editActions` is the whole permission model here: present means the section is editable, absent means it is not. */
const GroupHeader = ({ title, dragHandleProps, editActions, renameState }: GroupHeaderProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const renameCancelled = useRef(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [draft, setDraft] = useState(title ?? "");
	const isRenaming = renameState?.isRenaming;

	const startRenaming = () => {
		setDraft(title ?? "");
		renameCancelled.current = false;
		setMenuOpen(false);
		renameState?.onRenamingChange(true);
	};

	const handleRenameBlur = () => {
		const next = normalizeTitle(draft);
		if (!renameCancelled.current && next && next !== title) editActions?.onTitleChange(next);
		renameCancelled.current = false;
		renameState?.onRenamingChange(false);
	};

	return (
		<div className="flex items-center gap-2 group/hd">
			{editActions && isRenaming ? (
				<input
					aria-label={t("section-title")}
					className="min-w-0 border-0 bg-transparent p-0 py-[3px] font-semibold tracking-[-0.1px] text-primary-fg outline-none"
					onBlur={handleRenameBlur}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							renameCancelled.current = true;
							e.currentTarget.blur();
						} else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
							e.currentTarget.blur();
						}
					}}
					ref={inputRef}
					style={{ width: `${Math.max(draft.length + 1, 10)}ch` }}
					value={draft}
				/>
			) : (
				<span
					className={cn(
						"font-semibold py-[3px] tracking-[-0.1px] text-primary-fg",
						dragHandleProps && "touch-none",
						dragHandleProps && (dragHandleProps.isDragging ? "!cursor-grabbing" : "!cursor-grab"),
					)}
					{...dragHandleProps?.attributes}
					{...dragHandleProps?.listeners}
				>
					{title}
				</span>
			)}
			{editActions && (
				<>
					<span className="flex-1" />
					<DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
						<DropdownMenuTrigger asChild>
							<IconButton
								aria-label={t("more-actions")}
								className="opacity-0 transition-opacity duration-[140ms] group-hover/section:opacity-100 group-focus-within/hd:opacity-100 data-[state=open]:opacity-100"
								icon="ellipsis"
								onClick={(e) => e.stopPropagation()}
								onPointerDown={(e) => e.stopPropagation()}
								size="sm"
								variant="ghost"
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							onCloseAutoFocus={(e) => {
								e.preventDefault();
								if (isRenaming) {
									inputRef.current?.focus();
									inputRef.current?.select();
								}
							}}
						>
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									startRenaming();
								}}
							>
								{t("rename")}
							</DropdownMenuItem>
							{editActions.convertToFolderDisabled ? (
								<Tooltip>
									<TooltipTrigger className="cursor-default">
										<DropdownMenuItem disabled>{t("convert-to-folder")}</DropdownMenuItem>
									</TooltipTrigger>
									<TooltipContent>{t("convert-to-folder-disabled-empty")}</TooltipContent>
								</Tooltip>
							) : (
								<DropdownMenuItem onSelect={editActions.onConvertToFolder}>
									{t("convert-to-folder")}
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onClick={editActions.onDelete} type="danger">
								{t("delete")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</>
			)}
		</div>
	);
};

export default GroupHeader;
