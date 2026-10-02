import t from "@ext/localization/locale/translate";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSearchItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	useSearchableMenu,
} from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback, useMemo, useRef, useState } from "react";
import type { SessionTabItem } from "../types/chat";
import { ChatDropdownItem } from "./ChatDropdownItem";

type ChatDropdownProps = {
	sessions: SessionTabItem[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onClose: (id: string) => void;
	onRename: (id: string, title: string) => void;
};

export const ChatDropdown = ({ sessions, activeId, onSelect, onClose, onRename }: ChatDropdownProps) => {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [layout, setLayout] = useState({ alignOffset: 0, width: 288 });
	const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
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
				setEditingSessionId(null);
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
				// escape belongs to the row being renamed, not to the menu
				onEscapeKeyDown={(e) => {
					if (editingSessionId) e.preventDefault();
				}}
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
				<ScrollShadowContainer className="max-h-96">
					{visibleSessions.length === 0 ? (
						<div className="p-4 text-center text-sm text-muted-foreground">{t("agent.history.empty")}</div>
					) : (
						visibleSessions.map((session) => (
							<ChatDropdownItem
								editingSessionId={editingSessionId}
								isActive={session.id === activeId}
								key={session.id}
								onClose={onClose}
								onEditingChange={(editing) => setEditingSessionId(editing ? session.id : null)}
								onRename={onRename}
								onSelect={onSelect}
								session={session}
							/>
						))
					)}
				</ScrollShadowContainer>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

type HorizontalRect = Pick<DOMRect, "left" | "width">;

export const getDropdownLayout = (panel: HorizontalRect, trigger: Pick<DOMRect, "left">, inset: number) => ({
	alignOffset: panel.left + inset - trigger.left,
	width: Math.max(288, panel.width - inset * 2),
});
