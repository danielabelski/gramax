import Date from "@components/Atoms/Date";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { MenuItemIconButton } from "@ui-kit/MenuItem";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { SessionTabItem } from "../types/chat";
import { PlainTextInput } from "./PlainTextInput";

type ChatDropdownItemProps = {
	session: SessionTabItem;
	isActive: boolean;
	// id of the row currently being renamed, shared across rows so at most one can edit at a time
	editingSessionId: string | null;
	onEditingChange: (editing: boolean) => void;
	onSelect: (id: string) => void;
	onClose: (id: string) => void;
	onRename: (id: string, title: string) => void;
};

export const ChatDropdownItem = ({
	session,
	isActive,
	editingSessionId,
	onEditingChange,
	onSelect,
	onClose,
	onRename,
}: ChatDropdownItemProps) => {
	const { id, title, createdAt } = session;
	const editing = id === editingSessionId;
	const renameActive = editingSessionId !== null;
	const [draftTitle, setDraftTitle] = useState(title);
	const [actionsOpen, setActionsOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const cancelledRef = useRef(false);

	useEffect(() => {
		if (!editing) return;
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [editing]);

	const startEditing = useCallback(() => {
		setDraftTitle(title);
		onEditingChange(true);
	}, [title, onEditingChange]);

	// keys are stopped here so the menu does not treat typing as its own search or navigation
	const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
		e.stopPropagation();
		if (e.key !== "Enter" && e.key !== "Escape") return;
		e.preventDefault();
		cancelledRef.current = e.key === "Escape";
		e.currentTarget.blur();
	}, []);

	// radix focuses a row on hover and hands focus back to the menu when the pointer leaves it, which
	// would blur the rename input being edited on another row, so rows stop that while a rename is
	// open. the actions popup doesn't need this: it's a second modal layer, so the browser blocks
	// pointer events on every row underneath it while it's open — hover can't reach them at all
	const suppressPointerFocus = useCallback((e: PointerEvent<HTMLDivElement>) => e.preventDefault(), []);

	const handleBlur = useCallback(() => {
		const cancelled = cancelledRef.current;
		cancelledRef.current = false;
		onEditingChange(false);

		const nextTitle = draftTitle.trim();
		if (cancelled || !nextTitle) {
			setDraftTitle(title);
			return;
		}
		onRename(id, nextTitle);
	}, [draftTitle, id, title, onRename, onEditingChange]);

	return (
		<DropdownMenuItem
			className={cn(
				"group flex h-7 cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-xs font-normal",
				isActive && "bg-secondary-border",
			)}
			onPointerLeave={renameActive ? suppressPointerFocus : undefined}
			onPointerMove={renameActive ? suppressPointerFocus : undefined}
			onSelect={editing ? (e) => e.preventDefault() : () => onSelect(id)}
		>
			{editing ? (
				<PlainTextInput
					className="min-w-0 flex-1"
					onBlur={handleBlur}
					onChange={(e) => setDraftTitle(e.target.value)}
					onKeyDown={handleKeyDown}
					ref={inputRef}
					value={draftTitle}
				/>
			) : (
				<>
					<TextOverflowTooltip className="min-w-0 flex-1">
						{title || t("agent.history.new-chat")}
					</TextOverflowTooltip>
					{createdAt && <Date className="shrink-0 text-muted" date={createdAt} />}
					<DropdownMenu onOpenChange={setActionsOpen} open={actionsOpen}>
						<DropdownMenuTrigger asChild>
							<MenuItemIconButton
								aria-label={t("actions")}
								className="size-5 p-1"
								icon="ellipsis"
								onClick={(event) => {
									event.stopPropagation();
									setActionsOpen(true);
								}}
							/>
						</DropdownMenuTrigger>
						{/* a click inside this portal still bubbles through the React tree into the row's
						own onSelect, so it needs its own stop here in addition to each item's */}
						<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setActionsOpen(false);
									startEditing();
								}}
							>
								<Icon icon="pencil" />
								{t("agent.tooltips.rename-session")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setActionsOpen(false);
									onClose(id);
								}}
								type="danger"
							>
								<Icon icon="trash-2" />
								{t("agent.tooltips.delete-session")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</>
			)}
		</DropdownMenuItem>
	);
};
