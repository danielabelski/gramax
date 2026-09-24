import Skeleton from "@components/Atoms/ImageSkeleton";
import type { CSSProperties, ReactNode } from "react";

interface ImageSkeletonProps {
	width: string;
	height: string;
	isLoaded: boolean;
	children: ReactNode;
	className?: string;
	layoutReserved?: boolean;
	style?: CSSProperties;
}

export const ImageSkeleton = (props: ImageSkeletonProps) => {
	const { width, height, children, isLoaded, className, layoutReserved, style } = props;

	return (
		<Skeleton
			className={className}
			height={height}
			isLoaded={isLoaded}
			layoutReserved={layoutReserved}
			style={style}
			width={width}
		>
			{children}
		</Skeleton>
	);
};
