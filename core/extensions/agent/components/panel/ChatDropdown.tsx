import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSearchItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	useSearchableMenu,
} from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { MenuItemIconButton } from "@ui-kit/MenuItem";
import { TextOverflowTooltip, Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback, useMemo, useRef, useState } from "react";
import type { SessionTabItem } from "../types/chat";

type ChatDropdownProps = {
	sessions: SessionTabItem[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onClose: (id: string) => void;
};

type ChatSessionActionsProps = {
	onDelete: () => void;
};

const ChatSessionActions = ({ onDelete }: ChatSessionActionsProps) => {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
			<DropdownMenuTrigger asChild>
				<MenuItemIconButton
					aria-label={t("actions")}
					className="size-5 p-1"
					icon="ellipsis"
					onClick={(event) => {
						event.stopPropagation();
						setIsOpen(true);
					}}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={onDelete} type="danger">
					<Icon icon="trash-2" />
					{t("agent.tooltips.delete-session")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export const ChatDropdown = ({ sessions, activeId, onSelect, onClose }: ChatDropdownProps) => {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [layout, setLayout] = useState({ alignOffset: 0, width: 288 });
	const { search, setSearch, contentRef, inputRef, handleContentKeyDown, handleInputKeyDown, filterItems } =
		useSearchableMenu();
	const visibleSessions = useMemo(() => {
		return filterItems(
			sessions
				.filter((session) => session.hasUserMessage)
				.map((session) => ({ ...session, label: session.title })),
		);
	}, [filterItems, sessions]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				setSearch("");
				return;
			}

			const trigger = triggerRef.current;
			const panel = trigger?.closest<HTMLElement>("[data-floating-panel-id]");
			if (!trigger || !panel) return;

			setLayout(getDropdownLayout(panel.getBoundingClientRect(), trigger.getBoundingClientRect(), 16));
		},
		[setSearch],
	);

	return (
		<>
			<DropdownMenu onOpenChange={handleOpenChange}>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<DropdownMenuTrigger asChild>
								<FloatingTriggerButton aria-label={t("agent.tooltips.history")} ref={triggerRef}>
									<Icon className="h-3.5 w-3.5" icon="history" />
								</FloatingTriggerButton>
							</DropdownMenuTrigger>
						</span>
					</TooltipTrigger>
					<TooltipContent>{t("agent.tooltips.history")}</TooltipContent>
				</Tooltip>
				<DropdownMenuContent
					align="start"
					alignOffset={layout.alignOffset}
					className="max-h-[min(32rem,calc(100vh-6rem))] overflow-hidden rounded-2xl"
					onCloseAutoFocus={(e) => e.preventDefault()}
					onKeyDown={handleContentKeyDown}
					ref={contentRef}
					sideOffset={8}
					style={{ width: layout.width }}
				>
					<DropdownMenuSearchItem
						onChange={(e) => setSearch(e.target.value)}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={handleInputKeyDown}
						placeholder={t("agent.history.search-placeholder")}
						ref={inputRef}
						value={search}
					/>
					<DropdownMenuSeparator />
					<div className="max-h-96 overflow-y-auto">
						{visibleSessions.length === 0 ? (
							<div className="p-4 text-center text-sm text-muted-foreground">
								{t("agent.history.empty")}
							</div>
						) : (
							visibleSessions.map(({ id, title, createdAt }) => (
								<DropdownMenuItem
									className={cn(
										"group flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-xs h-7 font-normal",
										id === activeId && "bg-secondary-border",
									)}
									key={id}
									onSelect={() => onSelect(id)}
								>
									<TextOverflowTooltip className="min-w-0 flex-1">
										{title || t("agent.history.new-chat")}
									</TextOverflowTooltip>
									<span className="shrink-0 text-muted">{formatSessionAge(createdAt)}</span>
									<ChatSessionActions onDelete={() => onClose(id)} />
								</DropdownMenuItem>
							))
						)}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
};

export const formatSessionAge = (createdAt?: number, now = Date.now()): string => {
	if (!createdAt) return "";
	const minutes = Math.max(1, Math.floor((now - createdAt) / 60_000));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
};

type HorizontalRect = Pick<DOMRect, "left" | "width">;

export const getDropdownLayout = (panel: HorizontalRect, trigger: Pick<DOMRect, "left">, inset: number) => ({
	alignOffset: panel.left + inset - trigger.left,
	width: Math.max(288, panel.width - inset * 2),
});
