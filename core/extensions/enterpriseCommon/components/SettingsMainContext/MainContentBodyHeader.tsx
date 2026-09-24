import t from "@ext/localization/locale/translate";
import { IconButton } from "@ui-kit/Button";
import { DialogClose } from "@ui-kit/Dialog";
import { Divider } from "@ui-kit/Divider";
import { SidebarTrigger, useSidebar } from "@ui-kit/Sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import type { MutableRefObject } from "react";

interface MainContentBodyHeaderProps {
	headerRef: MutableRefObject<HTMLElement>;
}

export const MainContentBodyHeader = (props: MainContentBodyHeaderProps) => {
	const { headerRef } = props;
	const { state } = useSidebar();
	return (
		// ml-[1px] is to fix the overlap of sidebar border
		//   because backdrop-blur touches border and feels like 1 pixel cut off
		<div className="sticky shrink-0 top-0 z-[15] h-[3.75rem] pl-4 pt-3 pb-2 pr-3 backdrop-blur-[0.875rem] ml-[1px]">
			<div className="flex items-center gap-4 h-full">
				<Tooltip>
					<TooltipContent>
						<p>
							{state === "expanded"
								? t("enterprise.admin.hide-sidebar")
								: t("enterprise.admin.show-sidebar")}
						</p>
					</TooltipContent>
					<TooltipTrigger asChild>
						<SidebarTrigger aria-label="Open sidebar" className="-mr-2 p-1.5 h-[unset]" />
					</TooltipTrigger>
				</Tooltip>
				<Divider className="h-5" orientation="vertical" />
				<div className="flex-1 min-w-0" ref={headerRef as MutableRefObject<HTMLDivElement>}></div>
				<DialogClose asChild>
					<IconButton className="p-2.5 -ml-1" icon="X" variant="link" />
				</DialogClose>
			</div>
		</div>
	);
};
