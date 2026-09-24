import t from "@ext/localization/locale/translate";
import {
	GlassToolbarButton,
	type GlassToolbarButtonProps,
	GlassToolbarIcon,
	GlassToolbarText,
} from "@ui-kit/GlassToolbar";
import { forwardRef } from "react";

export const SearchButton = forwardRef<HTMLButtonElement, Omit<GlassToolbarButtonProps, "children">>((props, ref) => (
	<GlassToolbarButton focusable ref={ref} {...props}>
		<GlassToolbarIcon icon="search" />
		<GlassToolbarText className="hidden text-sm leading-4 font-normal [@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:inline [@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:inline">
			{t("search.name")}...
		</GlassToolbarText>
	</GlassToolbarButton>
));
