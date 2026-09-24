import GitIndexService from "@core-ui/ContextServices/GitIndexService";
import { getIndicatorOffset } from "@ext/navigation/catalog/SidebarNavigation/utils/getIndicatorOffset";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { tv } from "tailwind-variants";

const styles = tv({
	base: "pointer-events-none absolute top-1/2 h-[18px] w-0.5 -translate-y-1/2 rounded-xs bg-primary-accent",
	variants: {
		status: {
			[FileStatus.new]: "bg-[var(--color-status-new)]",
			[FileStatus.modified]: "bg-[var(--color-status-modified)]",
		},
	},
});

export const NavigationIndicator = ({ level, path }: { level: number; path: string }) => {
	const status = GitIndexService.getStatusByPath(path);
	if (!status) return null;

	return (
		<span
			className={styles({ status: status as FileStatus.modified | FileStatus.new })}
			style={{ left: getIndicatorOffset(level) }}
		/>
	);
};
