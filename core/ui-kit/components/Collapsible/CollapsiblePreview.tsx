import { cn } from "@core-ui/utils/cn";
import { forwardRef, type HTMLAttributes, useCallback, useLayoutEffect, useRef, useState } from "react";

type CollapsiblePreviewProps = HTMLAttributes<HTMLDivElement> & {
	collapsedHeight: number;
	contentClassName?: string;
	onCanExpandChange?: (canExpand: boolean) => void;
	open: boolean;
};

export const CollapsiblePreview = forwardRef<HTMLDivElement, CollapsiblePreviewProps>(
	(
		{ children, className, collapsedHeight, contentClassName, onCanExpandChange, open, style, ...props },
		forwardedRef,
	) => {
		const contentRef = useRef<HTMLDivElement>(null);
		const [contentHeight, setContentHeight] = useState(collapsedHeight);

		const updateContentHeight = useCallback(() => {
			const nextContentHeight = contentRef.current?.scrollHeight ?? collapsedHeight;
			setContentHeight(nextContentHeight);
			onCanExpandChange?.(nextContentHeight > collapsedHeight);
		}, [collapsedHeight, onCanExpandChange]);

		useLayoutEffect(() => {
			updateContentHeight();

			const content = contentRef.current;
			if (!content || typeof ResizeObserver === "undefined") return;

			const resizeObserver = new ResizeObserver(updateContentHeight);
			resizeObserver.observe(content);

			return () => resizeObserver.disconnect();
		}, [updateContentHeight]);

		return (
			<div
				{...props}
				className={cn(
					"overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none",
					className,
				)}
				data-state={open ? "open" : "closed"}
				ref={forwardedRef}
				style={{ ...style, height: open ? contentHeight : Math.min(collapsedHeight, contentHeight) }}
			>
				<div className={contentClassName} ref={contentRef}>
					{children}
				</div>
			</div>
		);
	},
);

CollapsiblePreview.displayName = "CollapsiblePreview";
