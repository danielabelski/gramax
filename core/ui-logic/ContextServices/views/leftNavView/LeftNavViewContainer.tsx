import LeftNavViewContentService, {
	type LeftNavViewContentComponent,
} from "@core-ui/ContextServices/views/leftNavView/LeftNavViewContentService";
import { memo } from "react";

const LeftNavViewContentContainer: LeftNavViewContentComponent = ({ itemLinks, closeNavigation }): JSX.Element => {
	const LeftNavViewContentValue = LeftNavViewContentService.value;
	if (!LeftNavViewContentValue) return null;
	return <LeftNavViewContentValue closeNavigation={closeNavigation} itemLinks={itemLinks} />;
};

export default memo(LeftNavViewContentContainer);
