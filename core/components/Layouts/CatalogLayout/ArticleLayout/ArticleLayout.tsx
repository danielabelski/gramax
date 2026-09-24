import { classNames } from "@components/libs/classNames";
import ArticleRefService from "@core-ui/ContextServices/ArticleRef";
import { cn } from "@core-ui/utils/cn";
import { cssMedia } from "@core-ui/utils/cssUtils";
// biome-ignore lint/style/noRestrictedImports: needs
import styled from "@emotion/styled";
import { ArticleBreadcrumbDiffLine } from "@ext/git/core/Diff/components/ArticleBreadcrumbDiffLine";
import { PAGE_WIDTH_PDF } from "@ext/print/const";
import { useLayoutEffect, useMemo } from "react";
import { ArticleDimensionsContext, createArticleDimensions } from "./useArticleDimensions";

export interface ArticleLayoutProps {
	article: JSX.Element;
	useArticleDefaultStyles: boolean;
	additionalStyles?: string;
	className?: string;
}

const ArticleLayout = (props: ArticleLayoutProps) => {
	const articleRef = ArticleRefService.value;
	const dimensions = useMemo(createArticleDimensions, []);

	const { article, useArticleDefaultStyles, className } = props;

	useLayoutEffect(() => {
		const articleContentWrapper = articleRef.current?.firstElementChild as HTMLDivElement;
		if (!articleContentWrapper) return;

		return dimensions.observe(articleContentWrapper, dimensions.setWidth);
	}, [dimensions]);

	return (
		<ArticleDimensionsContext.Provider value={dimensions}>
			<div
				className={classNames(cn("article-layout", className), {
					article: useArticleDefaultStyles,
				})}
				data-testid="article-scroll-container"
				ref={articleRef}
				tabIndex={-1}
			>
				<div
					className={cn("article-content-wrapper", useArticleDefaultStyles && "px-4 md:px-5 lg:px-6 lg:pt-6")}
					id="article"
				>
					<div
						className={classNames("article-content", {
							"article-default-content": useArticleDefaultStyles,
						})}
					>
						{article}
					</div>
					<ArticleBreadcrumbDiffLine />
				</div>
			</div>
		</ArticleDimensionsContext.Provider>
	);
};

export default styled(ArticleLayout)`
	box-sizing: border-box;
	padding-left: var(--article-layout-side-inset, 0px);
	padding-right: var(--right-zone-underlay-width, var(--article-layout-side-inset, 0px));
	transition: padding 300ms ease-out;

	&:focus {
		outline: none;
	}

	flex: 1;
	display: flex;
	overflow-y: auto;
	overflow-x: hidden;
	overflow-anchor: none;
	contain: layout paint;
	justify-content: center;
	background: var(--color-article-bg);

	.article-content-wrapper {
		position: relative;
		height: 100vh;
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.article-content {
		width: 100%;
		height: 100%;
	}

	.article-default-content {
		display: flex;
		min-width: 0px;
		max-width: var(--article-max-width);
		min-height: 100%;
		flex-direction: column;
	}

	${cssMedia.medium} {
		height: 100%;
		min-height: 0;
		display: flex;
		max-width: 100%;
		min-width: 100%;
		position: relative;
		flex-direction: row;
		overflow: hidden auto;
		overflow-anchor: none;
		background: var(--color-article-bg);

		.article-content-wrapper {
			height: 100vh;
			position: static;
			min-width: 100%;
			display: flex;
			justify-content: center;
			padding: 1rem;
		}

		.article-content {
			width: 100%;
			display: flex;
			min-width: 0px;
			max-width: var(--article-max-width);
			height: 100%;
			min-height: 100%;
			flex-direction: column;
		}

		@media only screen and (min-width: 48rem) {
			.article-content-wrapper {
				padding: 1.25rem;
			}
		}

		${cssMedia.narrow} {
			.article-content-wrapper {
				height: fit-content;
				min-height: 100dvh;
				min-height: -webkit-fill-available;
			}

			.article-content {
				height: unset;
				min-height: fit-content;
			}
		}
	}

	/* Below lg the navigation header and the top toolbar float over the article. */
	@media only screen and (max-width: 63.999rem) {
		.article-content-wrapper {
			padding-top: calc(4.375rem + var(--catalog-titlebar-offset,0rem));
		}
	}

	@media print {
		contain: none;
		margin-right: 0px;
		background: #fff;

		.article-content-wrapper {
			height: auto;
			padding-top: 0;
			padding-left: 30px;
			width: 100% !important;
		}

		.article-content {
			height: auto ;
		}

		.article-default-content {
			min-width: ${PAGE_WIDTH_PDF}px !important;
			height: auto ;
		}
	}
	${(p) => p.additionalStyles ?? ""}
`;
