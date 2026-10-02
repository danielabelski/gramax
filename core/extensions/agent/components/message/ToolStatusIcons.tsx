import { Icon } from "@ui-kit/Icon";

type ToolStatusIconsProps = {
	isPending: boolean;
	showCheck: boolean;
	isError: boolean;
};

export const ToolStatusIcons = ({ isPending, showCheck, isError }: ToolStatusIconsProps) => (
	<>
		{isPending && <Icon className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" icon="loader" />}
		{showCheck && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" icon="check" />}
		{isError && <Icon className="h-3.5 w-3.5 shrink-0 text-destructive" icon="alert-circle" />}
	</>
);
