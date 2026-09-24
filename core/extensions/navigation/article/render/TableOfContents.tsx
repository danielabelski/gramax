import ArticleRefService from "@core-ui/ContextServices/ArticleRef";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import t from "@ext/localization/locale/translate";
import { GroupHeader } from "@ext/navigation/article/render/GroupHeader";
import TocScrollspy from "@ext/navigation/article/render/TocScrollspy";
import { TocList } from "@ext/navigation/article/render/TocTree";
import { Icon } from "@ui-kit/Icon";

const TableOfContents = ({ className }: { className?: string }) => {
	const items = useArticlePropsStore((state) => state.data?.tocItems);
	const articleElement = ArticleRefService.value;

	if (!items.length || !ArticleViewService.isDefaultView) return null;

	return (
		<div className="flex min-h-0 flex-col">
			<GroupHeader className="flex items-center gap-2 opacity-70 uppercase">
				<Icon className="size-4" icon="list-content" />
				<span>{t("in-article")}</span>
			</GroupHeader>
			<TocScrollspy className={className} ref={articleElement}>
				<TocList items={items} level={0} />
			</TocScrollspy>
		</div>
	);
};

export default TableOfContents;
