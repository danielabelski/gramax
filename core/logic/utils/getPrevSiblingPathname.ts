import type Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type ContextualCatalog from "@core/FileStructue/Catalog/ContextualCatalog";

const getPrevSiblingPathname = async (catalog: Catalog | ContextualCatalog, path: Path) => {
	try {
		const item = catalog.findItemByItemPath(path);
		const siblings = catalog.getCategoryItems(item.parent);
		const index = siblings.indexOf(item);
		const target = index > 0 ? siblings[index - 1] : item.parent;
		return await catalog.getPathname(target);
	} catch {
		return null;
	}
};

export default getPrevSiblingPathname;
