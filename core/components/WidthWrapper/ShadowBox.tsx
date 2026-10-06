import { cn } from "@core-ui/utils/cn";

type Direction = "left" | "right";

/** The same edge fade as `ScrollShadowContainer` (ics-ui-kit): a straight ramp from transparent to the full article background. */
const fade = (direction: Direction) => `linear-gradient(to ${direction}, transparent, var(--color-article-bg))`;

interface ScrollableShadowProps {
	width?: number;
	height?: number;
	direction?: Direction;
	marginLeft?: number;
	force?: boolean;
}

const ScrollableShadow = ({ width, height, direction, marginLeft, force }: ScrollableShadowProps) => {
	return (
		(width > 0 || force) && (
			<div
				className={cn("shadow-box", direction, "top-0 z-[2] pointer-events-none absolute print:hidden")}
				data-width={width}
				style={{
					width: `${Math.min(width, 40)}px`,
					height: `${height}px`,
					background: fade(direction),
					[direction]: 0,
					...(marginLeft ? { marginLeft: `${marginLeft}px` } : {}),
				}}
			/>
		)
	);
};

export default ScrollableShadow;
