import { cn } from "@core-ui/utils/cn";
import { useDiffExtendedMode } from "@ext/git/core/Diff/components/store/DiffExtendedModeStore";
import t from "@ext/localization/locale/translate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ui-kit/Tooltip";
import type { ReactNode } from "react";

type PublishChangeCountProps = {
	added?: number;
	modified?: number;
	deleted?: number;
	className?: string;
	showTotal?: boolean;
};

type ChangeCountProps = {
	children: ReactNode;
	label: string;
	color: string;
};

const ChangeCount = ({ children, label, color }: ChangeCountProps) => (
	<Tooltip>
		<TooltipTrigger asChild>
			<span aria-label={label} role="img" style={{ color }}>
				{children}
			</span>
		</TooltipTrigger>
		<TooltipContent>{label}</TooltipContent>
	</Tooltip>
);

export const PublishChangeCount = ({
	added = 0,
	modified = 0,
	deleted = 0,
	className,
	showTotal = false,
}: PublishChangeCountProps) => {
	const extendedMode = useDiffExtendedMode();

	if (!added && !modified && !deleted) return null;
	if (!showTotal && !extendedMode) return null;

	return (
		<TooltipProvider>
			<span className={cn("flex shrink-0 items-center gap-1.5 font-mono text-xs", className)}>
				{added > 0 && (
					<ChangeCount color="var(--color-status-new)" label={`${t("diff.type.added")}: ${added}`}>
						+{added}
					</ChangeCount>
				)}
				{modified > 0 && (
					<ChangeCount color="var(--color-status-modified)" label={`${t("diff.type.modified")}: ${modified}`}>
						±{modified}
					</ChangeCount>
				)}
				{deleted > 0 && (
					<ChangeCount color="var(--color-status-deleted)" label={`${t("diff.type.deleted")}: ${deleted}`}>
						-{deleted}
					</ChangeCount>
				)}
			</span>
		</TooltipProvider>
	);
};
