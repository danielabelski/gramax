import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { CollapsibleTrigger } from "@ui-kit/Collapsible";
import { Icon } from "@ui-kit/Icon";

interface NavigationCollapseChevronProps {
	open: boolean;
}

export const NavigationCollapseChevron = ({ open }: NavigationCollapseChevronProps) => (
	<CollapsibleTrigger asChild>
		<button
			aria-label={open ? t("collapse") : t("expand")}
			className="angle group/actions mx-0 -my-1.5 flex h-7 w-11 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 text-left text-muted-foreground sm:my-0 sm:size-4"
			data-collapsible-trigger
			type="button"
		>
			<Icon
				className={cn(
					"shrink-0 stroke-[2.5] text-muted transition-transform group-hover/actions:text-primary-fg",
					open && "rotate-90",
				)}
				icon="chevron-right"
				size="sm"
			/>
		</button>
	</CollapsibleTrigger>
);
