import LinksBreadcrumb from "@components/Breadcrumbs/LinksBreadcrumb";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import useWatch from "@core-ui/hooks/useWatch";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { cn } from "@core-ui/utils/cn";
import { cssMedia } from "@core-ui/utils/cssUtils";
// biome-ignore lint/style/noRestrictedImports: it's ok
import styled from "@emotion/styled";
import getArticleItemLink from "@ext/article/LinkCreator/logic/getArticleItemLink";
import { useIsDoublePanel } from "@ext/git/core/Diff/components/store/DiffViewModeStore";
import { useIsDiffView } from "@ext/git/core/Diff/logic/hooks/useIsDiffView";
import ItemMenu from "@ext/item/EditMenu";
import t from "@ext/localization/locale/translate";
import NavigationDropdown from "@ext/navigation/components/NavigationDropdown";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { IconButton } from "@ui-kit/Button";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { useRef, useState } from "react";

interface ArticleBreadcrumbProps {
	itemLinks: ItemLink[];
	hasPreview: boolean;
	className?: string;
	showActions?: boolean;
}

const ArticleBreadcrumb = ({ className, itemLinks, hasPreview, showActions = true }: ArticleBreadcrumbProps) => {
	const linksRef = useRef<HTMLDivElement>(null);
	const breadcrumbRef = useRef<HTMLDivElement>(null);
	const isDoublePanel = useIsDoublePanel();
	const isDiff = useIsDiffView();

	const [itemLink, setItemLink] = useState<ItemLink>(null);

	const pageData = PageDataContextService.value;
	const articleProps = useArticlePropsStore((state) => ({ ref: state.data.ref, errorCode: state.data.errorCode }));
	const isReadOnly = pageData?.conf.isReadOnly;

	useWatch(() => {
		const newItemLink = getArticleItemLink(itemLinks, articleProps.ref.path);
		setItemLink(newItemLink);
	}, [articleProps.ref.path]);

	const showArticleActions =
		(!articleProps?.errorCode || articleProps?.errorCode === 500) && !!itemLink && showActions;
	const isHasPreview = hasPreview || (isDoublePanel && isDiff);

	return (
		<ComponentVariantProvider variant="glass">
			<div className={cn("article-breadcrumb", className, isHasPreview && "has-preview")} ref={breadcrumbRef}>
				<LinksBreadcrumb itemLinks={itemLinks} ref={linksRef} />
				{!isReadOnly && showArticleActions && (
					<div className="article-actions" data-qa="qa-article-actions">
						<NavigationDropdown
							className="article-actions"
							style={{ marginRight: "-2px" }}
							tooltipText={t("article.actions.title")}
							trigger={
								<IconButton
									aria-label={t("article.actions.title")}
									icon="ellipsis"
									iconClassName="size-4"
									size="sm"
									variant="ghost"
								/>
							}
						>
							<ItemMenu itemLink={itemLink} setItemLink={setItemLink} />
						</NavigationDropdown>
					</div>
				)}
			</div>
		</ComponentVariantProvider>
	);
};

export default styled(ArticleBreadcrumb)`
	position: relative;
	display: flex;
	align-items: center;
	flex-wrap: wrap;

	&.has-preview {
		width: 68%;
	}

	.article-actions {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: end;
		right: 0;
		bottom: -1em;
		margin-right: 4px;
		z-index: var(--z-index-foreground);
		opacity: var(--opacity-darken-element);
	}

	.article-actions i {
		font-size: 22px;
	}

	.article-actions:hover {
		opacity: var(--opacity-active-element);
	}

	${cssMedia.narrow} {
		margin-bottom: 0.25rem;
	}

	@media print {
		display: none;
	}
`;
