import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import { cn } from "@core-ui/utils/cn";
import { FeatureIcon } from "@ui-kit/Icon";
import type { Icon } from "ics-ui-kit/components/icon";
import type { HTMLAttributes } from "react";
import { tv } from "tailwind-variants";

export type PanelEmptyStateProps = HTMLAttributes<HTMLDivElement>;

export type PanelEmptyStateDescriptionProps = HTMLAttributes<HTMLDivElement>;

export type PanelEmptyStateTitleProps = HTMLAttributes<HTMLHeadingElement>;

interface PanelEmptyStateIconProps extends Omit<UiKitIconProps, "icon"> {
	icon: IconCode;
}

export const PanelEmptyState = ({ className, ...otherProps }: PanelEmptyStateProps) => {
	return (
		<div
			className={cn("flex flex-col items-center justify-center w-full h-full pb-20", className)}
			{...otherProps}
		/>
	);
};

export const PanelEmptyStateTitle = ({ className, ...otherProps }: PanelEmptyStateTitleProps) => {
	return <h2 className={cn("mt-3 font-semibold text-muted text-sm mb-2", className)} {...otherProps} />;
};

export const PanelEmptyStateDescription = ({ className, ...otherProps }: PanelEmptyStateDescriptionProps) => {
	return <div className={cn("text-center text-muted text-xs font-normal", className)} {...otherProps} />;
};

const pageStateFeatureIconStyles = tv({
	base: "rounded-full bg-status-neutral-bg-hover p-3.5 text-muted [&>svg]:shrink-0 w-8 h-8 [&>svg]:size-4",
});

type UiKitIconProps = React.ComponentProps<typeof Icon>;

export const PanelEmptyStateIcon = ({ icon, className, ...otherProps }: PanelEmptyStateIconProps) => {
	return <FeatureIcon className={pageStateFeatureIconStyles({ className })} icon={icon} {...otherProps} />;
};
