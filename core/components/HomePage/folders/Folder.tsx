import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { ActionCard, CardFolder, CardMenuTrigger, CardSubTitle, CardTitle } from "@ui-kit/Card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { type CSSProperties, memo, useEffect, useRef, useState } from "react";
import type { HomeFolder } from "../utils/homeLayoutTypes";
import { normalizeTitle } from "../utils/normalizeTitle";
import { FolderCatalogThumbs } from "./FolderCatalogThumbs";

export interface FolderMenuAction {
	key: string;
	label: string;
	onClick: () => void;
	type?: "danger";
}

interface FolderProps {
	folder: HomeFolder;
	linkByName: Record<string, CatalogLink>;
	style?: CSSProperties;
	className?: string;
	isRenaming?: boolean;
	onTitleChange?: (title: string) => void;
	onRenameBlur?: () => void;
	menuActions?: FolderMenuAction[];
}

const Folder = ({
	folder,
	linkByName,
	style,
	className,
	isRenaming,
	onTitleChange,
	onRenameBlur,
	menuActions,
}: FolderProps) => {
	const title = folder.title || t("new-section");
	const showMenu = menuActions && menuActions.length > 0;

	const inputRef = useRef<HTMLInputElement>(null);
	const renameCancelled = useRef(false);
	const [draft, setDraft] = useState(folder.title);

	useEffect(() => {
		if (!isRenaming) return;
		setDraft(folder.title);
		const id = setTimeout(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		}, 0);
		return () => clearTimeout(id);
	}, [isRenaming, folder.title]);

	const handleBlur = () => {
		const next = normalizeTitle(draft);
		if (!renameCancelled.current && next && next !== folder.title) onTitleChange?.(next);
		renameCancelled.current = false;
		onRenameBlur?.();
	};

	return (
		<CardFolder className="h-[132px]" data-folder={folder.id}>
			<ActionCard className={cn("h-full gap-2", className)}>
				{isRenaming ? (
					<CardTitle asChild className="truncate">
						<input
							aria-label={t("folder-title")}
							className="w-full min-w-0 border-0 bg-transparent p-0 pr-2 outline-none"
							onBlur={handleBlur}
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
							value={draft}
						/>
					</CardTitle>
				) : (
					<CardTitle className="truncate" style={style}>
						{title}
					</CardTitle>
				)}
				{!isRenaming && folder.description && (
					<CardSubTitle className="truncate">{folder.description}</CardSubTitle>
				)}
				<FolderCatalogThumbs folder={folder} linkByName={linkByName} />
				{showMenu && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<CardMenuTrigger
								aria-label={t("more-actions")}
								className="pointer-events-auto"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
								}}
								onPointerDown={(e) => e.stopPropagation()}
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
							{menuActions.map((action) => (
								<DropdownMenuItem
									key={action.key}
									onClick={(e) => {
										e.stopPropagation();
										action.onClick();
									}}
									type={action.type}
								>
									{action.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</ActionCard>
		</CardFolder>
	);
};

/** Memoized for the same reason as `Card`: each thumb inside resolves a catalog logo through its own image hook. */
export default memo(Folder);
