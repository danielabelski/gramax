import { cn } from "@core-ui/utils/cn";
import type { ReactNode } from "react";
import { useAnimatedVirtualList } from "./useAnimatedVirtualList";
import type { VirtualListOptions } from "./useVirtualList";

export type VirtualListProps<T> = VirtualListOptions<T> & {
	className?: string;
	animateChanges?: boolean;
	onAnimationEnd?: () => void;
	children: (item: T, index: number) => ReactNode;
};

export const VirtualList = <T,>({
	children,
	className,
	animateChanges = false,
	onAnimationEnd,
	...options
}: VirtualListProps<T>) => {
	const { listRef, rows, height, setInteractedKey, animating } = useAnimatedVirtualList(
		options,
		animateChanges,
		onAnimationEnd,
	);
	return (
		<div
			className={cn("relative w-full", className)}
			ref={listRef}
			style={{ height, overflowAnchor: "none", overflow: animating ? "clip" : undefined }}
		>
			{rows.map(({ row, top, clipBottom }, renderIndex) => (
				<div
					className="absolute inset-x-0 top-0"
					key={row.key}
					onFocusCapture={() => setInteractedKey(String(row.key))}
					onPointerDownCapture={() => setInteractedKey(String(row.key))}
					style={{
						height: row.size,
						transform: `translateY(${top}px)`,
						clipPath: clipBottom === undefined ? undefined : `inset(0 0 ${clipBottom}px 0)`,
						zIndex: rows.length - renderIndex,
					}}
				>
					{children(row.item, row.index)}
				</div>
			))}
		</div>
	);
};
