import { CATEGORY_ROOT_FILENAME } from "@app/config/const";
import Path from "@core/FileProvider/Path/Path";
import type { Article } from "@core/FileStructue/Article/Article";
import type ContextualCatalog from "@core/FileStructue/Catalog/ContextualCatalog";
import type { Category } from "@core/FileStructue/Category/Category";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import assert from "assert";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { AgentArticleParser } from "../parser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";

function resolveItemPath(
	catalog: ContextualCatalog,
	parentAgentItemPath: string,
	fileName: string,
	isCategory: boolean,
): { parentCategory: Category; targetItemPath: string } {
	let parentCategory: Category;
	if (!parentAgentItemPath) {
		parentCategory = catalog.getRootCategory();
	} else {
		const item = CatalogItemLookup.findItem(catalog, parentAgentItemPath);
		assert(item, `Parent category not found: ${parentAgentItemPath}`);
		assert(item.type === ItemType.category, `Parent is not a category (type=${item.type}): ${parentAgentItemPath}`);
		parentCategory = item as Category;
	}

	const candidatePath = isCategory
		? parentCategory.folderPath.join(new Path([fileName, CATEGORY_ROOT_FILENAME]))
		: parentCategory.folderPath.join(new Path(`${fileName}.md`));
	const relToCatalog = catalog.getRepositoryRelativePath(candidatePath);
	assert(relToCatalog, "createCatalogItem: cannot resolve child path relative to catalog");
	return {
		parentCategory,
		targetItemPath: relToCatalog.value,
	};
}

type CreateCatalogItemInput = {
	catalogName: string;
	itemPath: string;
	title: string;
};

export async function runCreateCatalogItem({
	app,
	ctx,
	commands,
	input,
}: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, itemPath, title } = input as CreateCatalogItemInput;
	if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
		return fail("System catalog is read-only");
	}
	try {
		const { isCategory, fileName, parentAgentItemPath } = CatalogItemLookup.parseItemPath(itemPath);
		const type = isCategory ? ItemType.category : ItemType.article;
		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		const isSkill =
			AgentResourcesProvider.isSkillItemPath(itemPath) ||
			AgentResourcesProvider.isSkillItemPath(parentAgentItemPath);

		let targetItemPath = "";
		let lookup: CatalogItemLookup;

		if (isSkill) {
			if (isCategory) return fail("Skill can only be created as article");
			const provider = catalog.customProviders.agentResourcesProvider;
			targetItemPath = AgentResourcesProvider.skillNametoItemPath(fileName);
			if (await provider.getSkillArticleByItemPath(targetItemPath)) {
				return fail(`Item already exists. itemPath: ${targetItemPath}`);
			}

			await provider.create(
				fileName,
				{
					type: "doc",
					content: [{ type: "paragraph", content: [] }],
				},
				app.formatter,
				app.parserContextFactory,
				app.parser,
				ctx,
				{ title, fileName },
			);
			lookup = new CatalogItemLookup(catalogName, targetItemPath, title);
		} else {
			const resolved = resolveItemPath(catalog, parentAgentItemPath, fileName, isCategory);
			targetItemPath = resolved.targetItemPath;
			const existing = catalog.findItemByItemPath(new Path(Path.join(catalog.name, targetItemPath)));
			if (existing) {
				return fail(`Item already exists. itemPath: ${targetItemPath}`);
			}

			const siblings = resolved.parentCategory.items;
			const lastSibling = siblings[siblings.length - 1];

			let createdItem: Article | Category;
			if (isCategory) {
				createdItem = await catalog.createCategory(fileName, resolved.parentCategory.ref);
				await createdItem.setOrderAfter(resolved.parentCategory, lastSibling);
			} else {
				createdItem = await catalog.createArticle(
					app.resourceUpdaterFactory,
					"",
					resolved.parentCategory.ref,
					false,
					lastSibling?.ref,
				);
			}

			const ru = app.resourceUpdaterFactory.withContext(catalog.ctx)(catalog);
			await createdItem.updateProps({ ...createdItem.props, fileName, title }, ru, catalog.deref);
			lookup = CatalogItemLookup.fromCatalogItem(catalog, createdItem);
		}

		await app.wm.current().refreshCatalog(catalog.name);
		const refreshedCatalog = await app.wm.current().getCatalog(catalogName, ctx);
		const refreshedItem = isSkill
			? await refreshedCatalog.customProviders.agentResourcesProvider.getSkillArticleByItemPath(targetItemPath)
			: refreshedCatalog.findItemByItemPath(new Path(Path.join(catalog.name, targetItemPath)));
		if (!refreshedItem) {
			return fail(`Created item not found after refresh. itemPath: ${targetItemPath}`);
		}

		const parser = await AgentArticleParser.open(
			app,
			ctx,
			commands,
			refreshedCatalog,
			refreshedItem as Article | Category,
		);
		const content = await parser.getMarkdownForAgent();

		return ok(
			{
				type,
				...(isSkill
					? lookup.asAgentJSON()
					: CatalogItemLookup.fromCatalogItem(refreshedCatalog, refreshedItem).asAgentJSON()),
				content,
			},
			{ refreshPage: true },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to create item: ${msg}`);
	}
}
