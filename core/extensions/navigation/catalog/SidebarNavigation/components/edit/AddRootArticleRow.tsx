import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { useCreateArticle } from "@ext/navigation/catalog/SidebarNavigation/hooks/useCreateArticle";
import { useNavigationTreeStore } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import { Icon } from "@ui-kit/Icon";

/** The standing way to add a root article: the last row of the tree, under every article. */
export const AddRootArticleRow = () => {
	const lastGroupId = useNavigationTreeStore((s) => s.rootIds.at(-1));
	const createArticle = useCreateArticle();
	const onClick = () => createArticle(undefined, lastGroupId);

	return (
		<button
			className={cn(
				"group/add-row mx-2.5 mt-3.5 flex h-7 items-center gap-2 rounded-lg px-2 text-sm font-light text-muted/60 touch:min-h-11",
				"transition-colors duration-[160ms] hover:text-primary-fg focus-visible:text-primary-fg focus-visible:shadow-focus",
			)}
			onClick={onClick}
			type="button"
		>
			<span aria-hidden="true" className="grid shrink-0">
				<Icon
					className="col-start-1 row-start-1 transition-opacity duration-[160ms] group-hover/add-row:opacity-0 group-focus-visible/add-row:opacity-0"
					icon="circle-fading-plus"
					size="sm"
				/>
				<Icon
					className="col-start-1 row-start-1 opacity-0 transition-opacity duration-[160ms] group-hover/add-row:opacity-100 group-focus-visible/add-row:opacity-100"
					icon="circle-plus"
					size="sm"
				/>
			</span>
			{t("article.add")}
		</button>
	);
};
