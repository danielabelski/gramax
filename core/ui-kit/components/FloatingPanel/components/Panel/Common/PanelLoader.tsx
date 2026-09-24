import { cn } from "@core-ui/utils/cn";
import { Loader } from "@ui-kit/Loader";

export type PanelLoaderProps = React.ComponentProps<typeof Loader>;

export const PanelLoader = ({ className, ...otherProps }: PanelLoaderProps) => {
	return (
		<Loader
			className={cn(
				"[&>div:first-of-type]:p-2.5 [&>div:first-of-type]:shrink-0 [&>div:first-of-type]:rounded-full",
				"[&>div:first-of-type]:bg-status-neutral-bg-hover w-full h-full text-muted font-normal",
				className,
			)}
			{...otherProps}
		/>
	);
};
