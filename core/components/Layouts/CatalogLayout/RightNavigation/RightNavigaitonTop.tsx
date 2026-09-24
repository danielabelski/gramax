import { useIsEnterprise } from "@ext/enterprise/utils/useIsEnterprise";
import UserMenu from "@ext/settings/components/UserMenu";
import { GlassToolbar } from "@ui-kit/GlassToolbar";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import type { CSSProperties } from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { ContentLanguageToolbar } from "./ContentLanguageToolbar";
import { COLLAPSED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME, RIGHT_NAVIGATION_WIDTH } from "./constants";
import { SearchToolbar } from "./SearchToolbar";
import { ThemeButton } from "./ThemeButton";

interface RightNavigationTopContentProps {
	isEnterprise: boolean;
}

export const RightNavigationTopContent = ({ isEnterprise }: RightNavigationTopContentProps) => (
	<div
		className="pointer-events-auto absolute z-[var(--z-index-header-navigation)]"
		style={{ right: VIEWPORT_PADDING, top: VIEWPORT_PADDING }}
	>
		<div
			className="flex w-auto items-center gap-2 [@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:w-[var(--right-navigation-width)] [@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:w-[var(--right-navigation-width)]"
			data-testid="right-navigation-top-controls"
			style={{ "--right-navigation-width": `${RIGHT_NAVIGATION_WIDTH}px` } as CSSProperties}
		>
			<SearchToolbar />
			<div className={COLLAPSED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME}>
				<ContentLanguageToolbar />
			</div>
			<GlassToolbar className="shrink-0" variant="single">
				{isEnterprise ? <UserMenu showThemeToggle triggerVariant="glass" /> : <ThemeButton />}
			</GlassToolbar>
		</div>
	</div>
);

export const RightNavigationTop = () => {
	const isEnterprise = useIsEnterprise();

	return (
		<ComponentVariantProvider variant="glass">
			<RightNavigationTopContent isEnterprise={isEnterprise} />
		</ComponentVariantProvider>
	);
};
