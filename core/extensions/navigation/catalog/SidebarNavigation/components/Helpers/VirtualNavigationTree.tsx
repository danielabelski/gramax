import { useVirtualNavigationRows } from "@ext/navigation/catalog/SidebarNavigation/hooks/useVirtualNavigationRows";
import type { NavigationRow } from "@ext/navigation/catalog/SidebarNavigation/utils/flattenNavigationRows";
import { SidebarGroup } from "@ui-kit/Sidebar";
import { VirtualList } from "@ui-kit/VirtualList";
import type { ReactNode, RefObject } from "react";

const getItemKey = (row: NavigationRow) => row.id;

export const VirtualNavigationTree = ({
	containerRef,
	children,
	beforeGroup,
	afterLastGroup,
	ancestorLines,
}: {
	containerRef: RefObject<HTMLDivElement>;
	children: (row: NavigationRow) => ReactNode;
	beforeGroup?: (groupId: string) => ReactNode;
	afterLastGroup?: (groupId: string) => ReactNode;
	ancestorLines?: (row: NavigationRow) => ReactNode;
}) => {
	const { rows, estimateSize, getScrollElement, pinnedKeys, selectedId, scope, notifyLayoutSettled, animateChanges } =
		useVirtualNavigationRows(containerRef);

	return (
		<VirtualList
			animateChanges={animateChanges}
			estimateSize={estimateSize}
			getItemKey={getItemKey}
			getScrollElement={getScrollElement}
			items={rows}
			key={scope}
			onAnimationEnd={notifyLayoutSettled}
			pinnedKeys={pinnedKeys}
			scrollToAlign="center"
			scrollToKey={selectedId}
		>
			{(row, index) => (
				<SidebarGroup
					className="relative px-2.5 py-0"
					style={{
						paddingLeft: `${0.625 + row.level - 1}rem`,
						paddingTop: row.level === 1 && index > 0 ? "0.75rem" : 0,
					}}
				>
					{ancestorLines?.(row)}
					{row.level === 1 && beforeGroup?.(row.groupId)}
					{children(row)}
					{index === rows.length - 1 && afterLastGroup?.(row.groupId)}
				</SidebarGroup>
			)}
		</VirtualList>
	);
};
