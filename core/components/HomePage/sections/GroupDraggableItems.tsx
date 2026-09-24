import Card from "@components/HomePage/Card";
import Folder, { type FolderMenuAction } from "@components/HomePage/folders/Folder";
import Url from "@core-ui/ApiServices/Types/Url";
import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import t from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import {
	type CSSProperties,
	type Dispatch,
	type SetStateAction,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { tv } from "tailwind-variants";
import Link from "../../Atoms/Link";
import { cardId, dropZoneId, folderId } from "../dnd/ids";
import { useHomeGroup } from "../HomeGroupContext";
import { canNavigateHomeFolder, type HomeFolder, type HomeItem } from "../utils/homeLayoutTypes";

const ontoTarget = "border-dashed border-muted bg-alpha-high-90";
// hoisted so the memoized `Folder` does not see a new style object on every drag frame
const NO_POINTER_EVENTS: CSSProperties = { pointerEvents: "none" };

const sortableCardStyles = tv({
	slots: {
		wrapper: "",
		inner: "rounded-xl",
		card: "",
	},
	variants: {
		editMode: {
			true: { wrapper: "touch-none" },
		},
		isDragging: {
			true: { wrapper: "!cursor-grabbing", card: "!cursor-grabbing" },
			false: { wrapper: "!cursor-grab", card: "!cursor-grab" },
		},
		isOverTarget: {
			true: { inner: ontoTarget, card: ontoTarget },
		},
	},
});

const sortableFolderStyles = tv({
	slots: {
		wrapper: "",
		card: "",
	},
	variants: {
		draggable: {
			true: { wrapper: "touch-none" },
		},
		isDragging: { true: {}, false: {} },
		isOverTarget: {
			true: { card: ontoTarget },
		},
	},
	// a folder only shows grab cursors while it is actually draggable
	compoundVariants: [
		{ draggable: true, isDragging: true, class: { wrapper: "!cursor-grabbing", card: "!cursor-grabbing" } },
		{ draggable: true, isDragging: false, class: { wrapper: "!cursor-grab", card: "!cursor-grab" } },
	],
});

const itemsContainerStyles = tv({
	variants: {
		isEmpty: {
			true: "relative flex h-[132px] flex-col items-center justify-center rounded-xl border border-dashed border-primary-border p-6",
			false: "grid group-content",
		},
	},
});

interface SortableCardProps {
	link: CatalogLink;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	editMode?: boolean;
	overTargetId?: string;
	setAnimationNode?: (id: string, node: HTMLDivElement | null) => void;
}

const SortableCard = ({ link, setIsAnyCardLoading, editMode, overTargetId, setAnimationNode }: SortableCardProps) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: cardId(link.name),
	});
	const style = {
		transform: overTargetId ? undefined : CSS.Translate.toString(transform),
		transition,
		opacity: isDragging ? 0.35 : 1,
	};
	const { wrapper, inner, card } = sortableCardStyles({
		editMode,
		isDragging,
		isOverTarget: overTargetId === link.name,
	});
	// both stay identity-stable so the memoized `Card` and its animation ref survive a drag frame untouched
	const handleClick = useCallback(() => {
		if (!editMode) setIsAnyCardLoading(true);
	}, [editMode, setIsAnyCardLoading]);
	const setInnerRef = useCallback(
		(node: HTMLDivElement | null) => setAnimationNode?.(cardId(link.name), node),
		[setAnimationNode, link.name],
	);
	return (
		<div
			className={wrapper()}
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			onDragStartCapture={(e) => e.preventDefault()}
		>
			<div className={inner()} ref={setInnerRef} style={editMode ? { pointerEvents: "none" } : undefined}>
				<Card className={card()} link={link} name={link.name} onClick={handleClick} />
			</div>
		</div>
	);
};

interface SortableFolderCardProps {
	folder: HomeFolder;
	linkByName: Record<string, CatalogLink>;
	editMode?: boolean;
	overTargetId?: string;
	setAnimationNode?: (id: string, node: HTMLDivElement | null) => void;
}

const SortableFolderCard = ({
	folder,
	linkByName,
	editMode,
	overTargetId,
	setAnimationNode,
}: SortableFolderCardProps) => {
	// bound here rather than in the parent's `map`: a callback built per item in a loop can never be memoized
	const { onConvertFolderToSection, onDeleteFolder, onOpenFolder, onRenameFolder } = useHomeGroup();
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: folderId(folder.id),
	});
	const [isRenaming, setIsRenaming] = useState(false);
	const style = {
		transform: overTargetId ? undefined : CSS.Translate.toString(transform),
		transition,
		opacity: isDragging ? 0.35 : 1,
	};
	const menuActions = useMemo(() => {
		if (!editMode) return [];
		const actions: (FolderMenuAction | false)[] = [
			onRenameFolder && { key: "rename", label: t("rename"), onClick: () => setIsRenaming(true) },
			onConvertFolderToSection && {
				key: "convert",
				label: t("convert-to-section"),
				onClick: () => onConvertFolderToSection(folder.id),
			},
			onDeleteFolder && {
				key: "delete",
				label: t("delete"),
				onClick: () => onDeleteFolder(folder.id),
				type: "danger",
			},
		];
		return actions.filter((action): action is FolderMenuAction => Boolean(action));
	}, [editMode, folder.id, onRenameFolder, onConvertFolderToSection, onDeleteFolder]);
	const handleTitleChange = useCallback(
		(title: string) => onRenameFolder?.(folder.id, title),
		[onRenameFolder, folder.id],
	);
	const handleRenameBlur = useCallback(() => setIsRenaming(false), []);
	const setCardRef = useCallback(
		(node: HTMLDivElement | null) => setAnimationNode?.(folderId(folder.id), node),
		[setAnimationNode, folder.id],
	);
	const draggable = editMode && !isRenaming;
	const shouldNavigate = canNavigateHomeFolder(folder, editMode) && !isRenaming;
	const { wrapper, card: cardCls } = sortableFolderStyles({
		draggable,
		isDragging,
		isOverTarget: overTargetId === folder.id,
	});
	const card = (
		<div ref={setCardRef}>
			<Folder
				className={cardCls()}
				folder={folder}
				isRenaming={isRenaming}
				linkByName={linkByName}
				menuActions={menuActions}
				onRenameBlur={handleRenameBlur}
				onTitleChange={handleTitleChange}
				style={!shouldNavigate && draggable ? NO_POINTER_EVENTS : undefined}
			/>
		</div>
	);
	return (
		<div
			className={wrapper()}
			onClick={shouldNavigate || isRenaming ? undefined : () => onOpenFolder?.(folder)}
			onDragStartCapture={(e) => e.preventDefault()}
			ref={setNodeRef}
			style={style}
			{...(draggable ? { ...attributes, ...listeners } : {})}
		>
			{shouldNavigate ? <Link href={Url.from({ pathname: folder.href })}>{card}</Link> : card}
		</div>
	);
};

interface GroupDraggableItemsProps {
	containerKey: string;
	items: HomeItem[];
	linkByName: Record<string, CatalogLink>;
}

const GroupDraggableItems = ({ containerKey, items, linkByName }: GroupDraggableItemsProps) => {
	const { setIsAnyCardLoading, editMode, layoutAnimationTick, overTargetId } = useHomeGroup();
	const { setNodeRef } = useDroppable({ id: dropZoneId(containerKey) });
	const sortableIds = useMemo(
		() => items.map((item) => (item.type === "catalog" ? cardId(item.name) : folderId(item.id))),
		[items],
	);
	const animationNodesRef = useRef(new Map<string, HTMLDivElement>());
	const previousRectsRef = useRef(new Map<string, DOMRect>());
	const lastHandledLayoutAnimationTickRef = useRef(layoutAnimationTick);
	const previousSortableIdsKeyRef = useRef(sortableIds.join("|"));
	const sortableIdsKey = sortableIds.join("|");

	const setAnimationNode = useCallback((id: string, node: HTMLDivElement | null) => {
		if (node) animationNodesRef.current.set(id, node);
		else animationNodesRef.current.delete(id);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: overTargetId re-triggers the rect capture only
	useLayoutEffect(() => {
		const tickChanged = layoutAnimationTick !== lastHandledLayoutAnimationTickRef.current;
		const layoutChanged = previousSortableIdsKeyRef.current !== sortableIdsKey;
		lastHandledLayoutAnimationTickRef.current = layoutAnimationTick;

		if (tickChanged && layoutChanged) {
			for (const [id, node] of animationNodesRef.current) {
				const previousRect = previousRectsRef.current.get(id);
				if (!previousRect) continue;

				const currentRect = node.getBoundingClientRect();
				const deltaX = previousRect.left - currentRect.left;
				const deltaY = previousRect.top - currentRect.top;
				if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;

				node.animate(
					[{ transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
					{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
				);
			}
		}

		const nextRects = new Map<string, DOMRect>();
		for (const [id, node] of animationNodesRef.current) nextRects.set(id, node.getBoundingClientRect());
		previousRectsRef.current = nextRects;
		previousSortableIdsKeyRef.current = sortableIdsKey;
	}, [layoutAnimationTick, sortableIdsKey, overTargetId]);

	const isEmpty = items.length === 0;

	return (
		<SortableContext items={sortableIds} strategy={rectSortingStrategy}>
			<div className={itemsContainerStyles({ isEmpty })} ref={setNodeRef}>
				{isEmpty && (
					<>
						<p className="mb-1.5 text-sm font-medium text-primary-accent">{t("empty-section-title")}</p>
						<p className="flex flex-wrap justify-center gap-1 text-center text-xs text-muted">
							{t("empty-section-description")}
						</p>
					</>
				)}
				{items.map((item) =>
					item.type === "catalog" ? (
						linkByName[item.name] ? (
							<SortableCard
								editMode={editMode}
								key={item.name}
								link={linkByName[item.name]}
								overTargetId={overTargetId}
								setAnimationNode={setAnimationNode}
								setIsAnyCardLoading={setIsAnyCardLoading}
							/>
						) : null
					) : (
						<SortableFolderCard
							editMode={editMode}
							folder={item}
							key={item.id}
							linkByName={linkByName}
							overTargetId={overTargetId}
							setAnimationNode={setAnimationNode}
						/>
					),
				)}
			</div>
		</SortableContext>
	);
};

export default GroupDraggableItems;
