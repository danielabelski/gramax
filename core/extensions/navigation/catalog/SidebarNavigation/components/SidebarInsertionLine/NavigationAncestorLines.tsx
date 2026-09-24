import { useNavigationTreeStore } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import { getAncestorLineLevels } from "@ext/navigation/catalog/SidebarNavigation/utils/getAncestorLineLevels";
import { VerticalLineSegment } from "./VerticalLineSegment";

export const NavigationAncestorLines = ({ id, level }: { id: string; level: number }) => {
	const levels = useNavigationTreeStore((state) => getAncestorLineLevels(id, level, state));
	return levels.map((depth) => (
		<VerticalLineSegment className="-bottom-0.5" key={depth} style={{ left: `${0.625 + depth - 1}rem` }} />
	));
};
