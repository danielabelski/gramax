import { useClampFloatingPanelsOnResize } from "../hooks/useClampFloatingPanelsOnResize";
import { FloatingPanelZones } from "./FloatingPanelZones";

interface FloatingPanelLayout {
	children: React.ReactNode;
	rightZoneUnderlay?: React.ReactNode;
	rightZoneUnderlayWidth?: number | string;
	rightDockedZoneClassName?: string;
	rightDockedZoneInset?: number;
	rightDockedZoneMaxWidth?: number;
	reserveRightUnderlay?: boolean;
	contentClassName?: string;
}

/** Wraps the main content with the panel zones and the drag context panels are docked with. */
export const FloatingPanelLayout = ({
	children,
	rightZoneUnderlay,
	rightZoneUnderlayWidth,
	rightDockedZoneClassName,
	rightDockedZoneInset,
	rightDockedZoneMaxWidth,
	reserveRightUnderlay,
	contentClassName,
}: FloatingPanelLayout) => {
	useClampFloatingPanelsOnResize();

	return (
		<div className="relative flex h-full min-h-0 w-full">
			<FloatingPanelZones
				contentClassName={contentClassName}
				reserveRightUnderlay={reserveRightUnderlay}
				rightDockedZoneClassName={rightDockedZoneClassName}
				rightDockedZoneInset={rightDockedZoneInset}
				rightDockedZoneMaxWidth={rightDockedZoneMaxWidth}
				rightZoneUnderlay={rightZoneUnderlay}
				rightZoneUnderlayWidth={rightZoneUnderlayWidth}
			>
				{children}
			</FloatingPanelZones>
		</div>
	);
};
