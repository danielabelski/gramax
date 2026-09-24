import { cn } from "@core-ui/utils/cn";
import React, { useEffect } from "react";

// ics-ui-kit's `ScrollShadowContainer` fades its mask from the very top of the scroll box, with no
// way to skip past a sticky header — the header (opaque) just paints over that region, hiding the
// shadow entirely. `topOffset`/`bottomOffset` let the mask start past a sticky header/footer instead.
export interface OffsetScrollShadowContainerProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
	shadowSize?: number;
	topOffset?: number;
	bottomOffset?: number;
}

export const OffsetScrollShadowContainer = React.forwardRef<HTMLDivElement, OffsetScrollShadowContainerProps>(
	({ className, children, shadowSize = 28, topOffset = 0, bottomOffset = 0, ...props }, ref) => {
		const scrollRef = React.useRef<HTMLDivElement>(null);
		const contentRef = React.useRef<HTMLDivElement>(null);
		const prevKeyRef = React.useRef<string>("");

		React.useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement);

		const updateMask = React.useCallback(() => {
			const el = scrollRef.current;
			if (!el) return;

			const { scrollTop, scrollHeight, clientHeight, clientWidth, offsetWidth } = el;
			const showTop = scrollTop > 0;
			const showBottom = scrollTop < scrollHeight - clientHeight - 1;

			const state = (showTop ? 1 : 0) | (showBottom ? 2 : 0);
			// Keyed on width too, not just showTop/showBottom — a resize can change clientWidth without
			// flipping either flag, and the mask's maskSize is computed from clientWidth below, so a
			// width-only change must still force a recompute or the mask stays sized to the old width.
			const key = `${state}:${clientWidth}:${offsetWidth}`;
			if (key === prevKeyRef.current) return;
			prevKeyRef.current = key;

			if (state === 0) {
				el.style.maskImage = "";
				el.style.webkitMaskImage = "";
				el.style.maskSize = "";
				el.style.webkitMaskSize = "";
				el.style.maskPosition = "";
				el.style.webkitMaskPosition = "";
				el.style.maskRepeat = "";
				el.style.webkitMaskRepeat = "";
				return;
			}

			const topShadowEnd = topOffset + shadowSize;
			const bottomShadowStart = `calc(100% - ${bottomOffset + shadowSize}px)`;

			const top = showTop ? `black ${topOffset}px, transparent ${topOffset}px, black ${topShadowEnd}px` : "black";
			const bottom = showBottom
				? `black ${bottomShadowStart}, transparent calc(100% - ${bottomOffset}px)`
				: "black";

			const gradient = `linear-gradient(to bottom, ${top}, ${bottom})`;
			const solid = "linear-gradient(black, black)";

			const scrollbarWidth = offsetWidth - clientWidth;

			const mask = `${gradient}, ${solid}`;
			const maskSize = `${clientWidth}px 100%, ${scrollbarWidth}px 100%`;
			const maskPosition = "left top, right top";
			const maskRepeat = "no-repeat, no-repeat";

			el.style.maskImage = mask;
			el.style.webkitMaskImage = mask;
			el.style.maskSize = maskSize;
			el.style.webkitMaskSize = maskSize;
			el.style.maskPosition = maskPosition;
			el.style.webkitMaskPosition = maskPosition;
			el.style.maskRepeat = maskRepeat;
			el.style.webkitMaskRepeat = maskRepeat;
		}, [shadowSize, topOffset, bottomOffset]);

		useEffect(() => {
			const el = scrollRef.current;
			if (!el) return;

			updateMask();
			el.addEventListener("scroll", updateMask, { passive: true });
			return () => el.removeEventListener("scroll", updateMask);
		}, [updateMask]);

		useEffect(() => {
			const scrollEl = scrollRef.current;
			const contentEl = contentRef.current;
			if (!scrollEl || !contentEl) return;

			const observer = new ResizeObserver(updateMask);
			observer.observe(scrollEl);
			observer.observe(contentEl);
			return () => observer.disconnect();
		}, [updateMask]);

		return (
			<div className={cn("overflow-auto", className)} ref={scrollRef} {...props}>
				<div ref={contentRef}>{children}</div>
			</div>
		);
	},
);

OffsetScrollShadowContainer.displayName = "OffsetScrollShadowContainer";
