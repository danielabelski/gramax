import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { Button, type ButtonProps, TriggerButton } from "@ui-kit/Button";
import { Icon } from "@ui-kit/Icon";
import { Loader } from "@ui-kit/Loader";
import { forwardRef, type ReactNode } from "react";

interface RightNavigationButtonProps
	extends Omit<ButtonProps, "children" | "className" | "containerClassName" | "size" | "variant"> {
	children: ReactNode;
	className?: string;
	containerClassName?: string;
	fullWidth?: boolean;
	isLoading?: boolean;
	trailingIcon?: IconCode;
	/** Renders the button as a dropdown/popover trigger, so it picks up the open-state styles. */
	asTrigger?: boolean;
}

export const RightNavigationButton = forwardRef<HTMLButtonElement, RightNavigationButtonProps>((props, ref) => {
	const {
		asTrigger = false,
		children,
		className,
		containerClassName,
		fullWidth = true,
		isLoading = false,
		trailingIcon,
		...buttonProps
	} = props;

	const ButtonComponent = asTrigger ? TriggerButton : Button;

	return (
		<ButtonComponent
			className={cn(
				fullWidth && "w-full",
				"text-muted hover:text-muted active:text-primary-fg data-[state=open]:text-primary-fg",
				className,
			)}
			containerClassName={cn(fullWidth && "w-full", "justify-start", containerClassName)}
			ref={ref}
			size="sm"
			variant="ghost"
			{...buttonProps}
		>
			{children}
			{isLoading ? (
				<Loader aria-label={t("loading")} className="px-0 shrink-0" role="progressbar" size="sm" />
			) : (
				trailingIcon && <Icon className="shrink-0" icon={trailingIcon} />
			)}
		</ButtonComponent>
	);
});
