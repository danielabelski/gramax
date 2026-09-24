import { cn } from "@core-ui/utils/cn";
import { InsertionConnectorLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/InsertionConnectorLine";
import { InsertionDepthIcon } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/InsertionDepthIcon";
import { InsertionTailLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/InsertionTailLine";
import { useInsertionLine } from "@ext/navigation/catalog/SidebarNavigation/hooks/useInsertionLine";
import { useLazyAnimatedPresence } from "@ext/navigation/catalog/SidebarNavigation/hooks/useLazyAnimatedPresence";
import { useNavigationTreeStore } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import { Fragment, forwardRef, memo, useCallback, useEffect, useRef, useState } from "react";

const INSERTION_LINE_EXIT_FALLBACK_MS = 250;

export type SidebarInsertionLineProps = {
	className?: string;
	minDepth: number;
	maxDepth: number;
	level: number;
	onAdd: (depth: number) => void;
	onParentHover?: (depth: number | null) => void;
};

const SidebarInsertionLineComponent = forwardRef<HTMLDivElement, SidebarInsertionLineProps>(
	({ className, minDepth, maxDepth, level, onAdd, onParentHover }, ref) => {
		const [isHovered, setIsHovered] = useState(false);
		const wasDndActiveRef = useRef(false);
		const isDndActive = useNavigationTreeStore((state) => state.draggingId !== null);
		const {
			isPresent: areVisualsMounted,
			isVisible: areVisualsVisible,
			onTransitionEnd: handleVisualsTransitionEnd,
		} = useLazyAnimatedPresence({
			exitFallbackMs: INSERTION_LINE_EXIT_FALLBACK_MS,
			forceOpen: isDndActive,
			isOpen: isHovered,
		});
		const { items, tailLeft, isTailSolid, clickableDepth, overhang, handleMouseMove, handleMouseLeave } =
			useInsertionLine({
				minDepth,
				maxDepth,
				isHovered,
				levelOffset: level - 1,
				onParentHover,
			});
		const handleClick = useCallback(
			(event: React.MouseEvent<HTMLDivElement>) => {
				if (clickableDepth) {
					onAdd(clickableDepth);
					return;
				}

				const interactiveElementBehind = document
					.elementsFromPoint(event.clientX, event.clientY)
					.map((element) => element.closest<HTMLElement>("a, button, [role='button']"))
					.find((element) => element && !event.currentTarget.contains(element));

				interactiveElementBehind?.click();
			},
			[clickableDepth, onAdd],
		);
		const handlePointerEnter = useCallback(() => setIsHovered(true), []);
		const handlePointerLeave = useCallback(() => {
			setIsHovered(false);
			handleMouseLeave();
		}, [handleMouseLeave]);

		useEffect(() => {
			if (isDndActive) {
				wasDndActiveRef.current = true;
				return;
			}

			if (!wasDndActiveRef.current) return;
			wasDndActiveRef.current = false;
			if (!isHovered) handleMouseLeave();
		}, [handleMouseLeave, isDndActive, isHovered]);

		return (
			<div
				className={cn(
					"group/insertion absolute inset-x-0 bottom-0 z-10 h-1",
					clickableDepth && "cursor-pointer",
					className,
				)}
				data-sidebar="sidebar-insertion-line"
				onClick={handleClick}
				onMouseMove={handleMouseMove}
				onPointerEnter={handlePointerEnter}
				onPointerLeave={handlePointerLeave}
				ref={ref}
				style={{ left: -overhang }}
			>
				{areVisualsMounted && (
					<div
						className={cn(
							"pointer-events-none absolute inset-0 delay-75 duration-[160ms] transition-opacity",
							areVisualsVisible ? "opacity-100" : "opacity-0",
						)}
						data-sidebar="sidebar-insertion-line-visuals"
						onTransitionEnd={handleVisualsTransitionEnd}
						style={{ left: overhang }}
					>
						{items.map(({ depth, isHidden, isPlaceholder, isActive, iconLeft, connectorLeft }) => (
							<Fragment key={depth}>
								{connectorLeft && (
									<InsertionConnectorLine isHidden={isHidden} style={{ left: connectorLeft }} />
								)}
								<InsertionDepthIcon
									isActive={isActive}
									isHidden={isHidden}
									isPlaceholder={isPlaceholder}
									style={{ left: iconLeft }}
								/>
							</Fragment>
						))}

						<InsertionTailLine
							className={
								isTailSolid
									? "bg-primary-fg"
									: "[background:linear-gradient(90deg,hsl(var(--muted))_0%,rgba(113,113,122,0.00)_100%)]"
							}
							style={{ left: tailLeft }}
						/>
					</div>
				)}
			</div>
		);
	},
);
SidebarInsertionLineComponent.displayName = "SidebarInsertionLine";

export const SidebarInsertionLine = memo(SidebarInsertionLineComponent);
SidebarInsertionLine.displayName = "SidebarInsertionLine";
