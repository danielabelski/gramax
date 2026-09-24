import t from "@ext/localization/locale/translate";
import { ReviewListCounter } from "@ext/review/components/ReviewListCounter";
import { useScopedItems } from "@ext/review/logic/hooks/useScopedItems";
import { useReviewStore } from "@ext/review/logic/store/ReviewStore";
import type { ReviewScope } from "@ext/review/models/ReviewList";
import { Tabs, TabsList, TabsTrigger } from "@ui-kit/Tabs";

export const ReviewScopeTabs = () => {
	const catalogData = useScopedItems("catalog");
	const articleData = useScopedItems("article");
	const { currentScope, setCurrentScope } = useReviewStore((state) => ({
		currentScope: state.currentScope,
		setCurrentScope: state.setCurrentScope,
	}));

	return (
		<Tabs onValueChange={(value) => setCurrentScope(value as ReviewScope)} value={currentScope}>
			<TabsList className="grid w-full grid-cols-2 p-0.5 !h-auto">
				<TabsTrigger className="h-7 gap-1 px-2 py-1 text-sm" value="catalog">
					{t("editor.modes.tabs.catalog")}
					<ReviewListCounter className="ml-0 text-muted" count={catalogData.count} indicator={false} />
				</TabsTrigger>
				<TabsTrigger className="h-7 gap-1 px-2 py-1 text-sm" value="article">
					{t("editor.modes.tabs.article")}
					<ReviewListCounter className="ml-0 text-muted" count={articleData.count} indicator={false} />
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
};
