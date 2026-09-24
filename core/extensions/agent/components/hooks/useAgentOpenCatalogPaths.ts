import Path from "@core/FileProvider/Path/Path";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { useMemo } from "react";

export const useAgentOpenCatalogPaths = (): { openCatalogName: string | null; openItemPath: string | null } => {
	const articlePath = useArticlePropsStore((s) => s.data.ref.path);
	return useMemo(() => {
		const openPath = new Path(articlePath);
		const openCatalogName = openPath.rootDirectory.value || null;
		const openItemPath = openCatalogName ? openPath.rootDirectory.subDirectory(openPath)?.value || null : null;
		return { openCatalogName, openItemPath };
	}, [articlePath]);
};
