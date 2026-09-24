import { SelectContent as UiKitSelectContent } from "ics-ui-kit/components/select";
import type { FC } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";
import { VIEWPORT_PADDING } from "../../lib/floating";

interface UiKitSelectContentProps extends ExtractComponentGeneric<typeof UiKitSelectContent> {
	maxItems?: number;
}

export const SelectContent: FC<UiKitSelectContentProps> = (props) => {
	const { collisionPadding = VIEWPORT_PADDING, ...otherProps } = props;
	return (
		<UiKitSelectContent
			collisionPadding={collisionPadding}
			data-radix-select
			{...otherProps}
			data-testid="select-content"
		/>
	);
};
