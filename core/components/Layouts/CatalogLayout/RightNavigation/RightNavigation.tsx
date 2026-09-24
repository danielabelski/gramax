import Button, { TextSize } from "@components/Atoms/Button/Button";
import { ButtonStyle } from "@components/Atoms/Button/ButtonStyle";
import { ArticlePropertiesSection } from "@components/Layouts/CatalogLayout/RightNavigation/sections/ArticlePropertiesSection";
import { CatalogSection } from "@components/Layouts/CatalogLayout/RightNavigation/sections/CatalogSection";
import { LinksSection } from "@components/Layouts/CatalogLayout/RightNavigation/sections/LinksSection";
import IconLink from "@components/Molecules/IconLink";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import t from "@ext/localization/locale/translate";
import TableOfContents from "@ext/navigation/article/render/TableOfContents";
import { useRef } from "react";
import { tv } from "tailwind-variants";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { useCanSeeNavigationBottom } from "../useCanSeeNavigationBottom";
import { RIGHT_NAVIGATION_PANEL_INSET, RIGHT_NAVIGATION_WIDTH } from "./constants";

const asideStyles = tv({
	base: "flex min-h-0 w-full flex-1 flex-col space-y-6 overflow-hidden",
});

const gramaxLinkStyles = tv({
	base: "w-full flex justify-end items-end flex-1 mt-[2em]",
});

const gramaxLinkTextStyles = tv({
	base: "opacity-60 hover:opacity-100",
});

const RightNavigation = (): JSX.Element => {
	const ref = useRef<HTMLDivElement>(null);
	const errorCode = useArticlePropsStore((s) => s.data?.errorCode);
	const showArticleActions = errorCode !== 500;
	const { isNext } = usePlatform();
	const canSeeNavigationBottom = useCanSeeNavigationBottom();

	return (
		<div
			className="article-right-sidebar ml-auto flex h-full min-h-0 flex-1 flex-col bg-[var(--color-article-bg)]"
			ref={ref}
			style={{
				paddingTop: RIGHT_NAVIGATION_PANEL_INSET,
				paddingBottom: canSeeNavigationBottom ? RIGHT_NAVIGATION_PANEL_INSET : VIEWPORT_PADDING,
				paddingLeft: VIEWPORT_PADDING,
				marginRight: VIEWPORT_PADDING,
				width: RIGHT_NAVIGATION_WIDTH + VIEWPORT_PADDING,
			}}
		>
			<aside className={asideStyles()}>
				<CatalogSection />
				{showArticleActions && <ArticlePropertiesSection />}
				{showArticleActions && <TableOfContents className="min-h-0 overflow-y-auto px-3" />}
				<LinksSection />
			</aside>
			{isNext && (
				<div className={gramaxLinkStyles()}>
					<Button buttonStyle={ButtonStyle.transparent} textSize={TextSize.XS}>
						<IconLink
							className={gramaxLinkTextStyles()}
							href={"https://gram.ax/"}
							isExternal
							text={t("created-in-gramax")}
						/>
					</Button>
				</div>
			)}
		</div>
	);
};

export default RightNavigation;
