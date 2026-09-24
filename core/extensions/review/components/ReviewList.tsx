import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import t from "@ext/localization/locale/translate";
import { ReviewItemSearcher } from "@ext/review/components/ReviewItemSearcher";
import { ReviewItemsList } from "@ext/review/components/ReviewItemsList";
import { useReviewList } from "@ext/review/logic/hooks/useReviewList";
import { useScopedItems } from "@ext/review/logic/hooks/useScopedItems";
import { useReviewStore } from "@ext/review/logic/store/ReviewStore";
import {
	PanelEmptyState,
	PanelEmptyStateDescription,
	PanelEmptyStateIcon,
	PanelEmptyStateTitle,
} from "@ui-kit/FloatingPanel";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import type { RefObject } from "react";

export const ReviewList = ({ panelRef }: { panelRef: RefObject<HTMLDivElement> }) => {
	const articlePathname = useArticlePropsStore((state) => state.data?.pathname);
	const currentScope = useReviewStore((s) => s.currentScope);

	const { isLoading: isCatalogLoading } = useReviewList(undefined, "catalog");
	const { isLoading: isArticleLoading } = useReviewList(articlePathname, "article");

	const scopedCatalogData = useScopedItems("catalog");
	const scopedArticleData = useScopedItems("article");
	const noComments = !isCatalogLoading && !isArticleLoading && !scopedArticleData?.count && !scopedCatalogData?.count;

	return (
		<ComponentVariantProvider variant="glass">
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden" ref={panelRef}>
				<div
					className="editor-mode-menu flex flex-col overflow-hidden min-h-0 flex-1"
					data-testid="editor-mode-menu"
				>
					<div className="flex flex-col overflow-hidden min-h-0 flex-1">
						<ReviewItemSearcher />
						{!noComments && currentScope === "catalog" && (
							<ReviewItemsList data={scopedCatalogData} isLoading={isCatalogLoading} />
						)}
						{!noComments && currentScope === "article" && (
							<ReviewItemsList data={scopedArticleData} isLoading={isArticleLoading} />
						)}
						{noComments && (
							<PanelEmptyState>
								<PanelEmptyStateIcon icon="comment" />
								<PanelEmptyStateTitle>{t("editor.modes.empty-state.title")}</PanelEmptyStateTitle>
								<PanelEmptyStateDescription className="max-w-56">
									{t("editor.modes.empty-state.description")}
								</PanelEmptyStateDescription>
							</PanelEmptyState>
						)}
					</div>
				</div>
			</div>
		</ComponentVariantProvider>
	);
};
