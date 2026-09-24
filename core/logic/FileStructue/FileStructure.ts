import { CATEGORY_ROOT_FILENAME, DOC_ROOT_FILENAME, DOC_ROOT_FILENAMES } from "@app/config/const";
import { getExecutingEnvironment } from "@app/resolveModule/env";
import { createEventEmitter, type Event, type EventArgs } from "@core/Event/EventEmitter";
import type MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import type FileInfo from "@core/FileProvider/model/FileInfo";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import { Article, type ArticleProps } from "@core/FileStructue/Article/Article";
import type FileStructureBackend from "@core/FileStructue/backend/FileStructureBackend";
import type {
	ArticleNodeDto,
	CatalogTreeDto,
	CategoryNodeDto,
	NodeDto,
	WorkspaceEntryDto,
} from "@core/FileStructue/backend/FileStructureBackend";
import findDocroot from "@core/FileStructue/backend/findDocroot";
import resolveFileStructureBackend from "@core/FileStructue/backend/resolveFileStructureBackend";
import { FS_EXCLUDE_CATALOG_NAMES } from "@core/FileStructue/backend/scanExcludes";
import type BaseCatalog from "@core/FileStructue/Catalog/BaseCatalog";
import { Catalog } from "@core/FileStructue/Catalog/Catalog";
import CatalogEntry from "@core/FileStructue/Catalog/CatalogEntry";
import type CatalogEvents from "@core/FileStructue/Catalog/CatalogEvents";
import { type CatalogProps, ExcludedProps, normalizeCatalogProps } from "@core/FileStructue/Catalog/CatalogProps";
import { Category, type CategoryProps } from "@core/FileStructue/Category/Category";
import type { Item } from "@core/FileStructue/Item/Item";
import { roundedOrderAfter } from "@core/FileStructue/Item/ItemOrderUtils";
import type PathnameData from "@core/RouterPath/model/PathnameData";
import { uniqueName } from "@core/utils/uniqueName";
import type CatalogEditProps from "@ext/catalog/actions/propsEditor/model/CatalogEditProps";
import { resolveLanguage } from "@ext/localization/core/model/Language";
import { addEvent, Level, trace } from "@ext/loggers/opentelemetry";
import assert from "assert";
import matter from "gray-matter";
import * as yaml from "js-yaml";

export type FSLazyLoadCatalog = (entry: CatalogEntry) => Promise<Catalog>;

export type CollisionMovement = { oldPath: Path; newPath: Path };

export type FSEvents = Event<
	"before-catalog-entry-read",
	{ path: Path; checkIsExists: boolean; initProps: CatalogProps }
> &
	Event<"catalog-entry-read", { entry: CatalogEntry }> &
	Event<"catalog-pathname-resolve", { pathnameData: PathnameData; mutable: { pathname: string } }> &
	Event<"catalog-read", { fs: FileStructure; catalog: Catalog }> &
	Event<"catalog-collision-healed", { fs: FileStructure; catalog: Catalog; movements: CollisionMovement[] }> &
	Event<"item-filter", { fs: FileStructure; item: Item; parent: Category; catalogProps: CatalogProps }> &
	Event<"category-filter", { fs: FileStructure; item: Item; parent: Category; catalogProps: CatalogProps }> &
	Event<"item-save", { item: Item }> &
	Event<"catalog-save", { catalog: Catalog }> &
	Event<"item-moved", EventArgs<CatalogEvents, "item-moved">> &
	Event<"item-deleted", EventArgs<CatalogEvents, "item-deleted">> &
	Event<"item-created", EventArgs<CatalogEvents, "item-created">> &
	Event<"item-serialize", { mutable: { content: string; props: ArticleProps } }> &
	Event<"before-item-create", { catalog: Catalog; mutableItem: { item: Item } }> &
	Event<"item-order-updated", EventArgs<CatalogEvents, "item-order-updated">> &
	Event<"item-props-updated", EventArgs<CatalogEvents, "item-props-updated">> &
	Event<"item-read", { catalog: Catalog; mutable: { content: string; props: ArticleProps } }>;

// biome-ignore lint/suspicious/noExplicitAny: generic props bag for serialization
export type FSProps = { [key: string]: any };

export type MarkdownProps = {
	props: ArticleProps;
	content: string;
};

/**
 * Git flags a backend saw while scanning. A backend that cannot see the repository reports none, and
 * the absence is the signal for `FSCatalogEntryAttachGit` to probe the directory itself — so the keys
 * must stay out of the props entirely rather than be set to `undefined`.
 */
type GitCatalogProps = Pick<CatalogProps, "isGitRepo" | "isBareRepo" | "hasGitmodules">;

const gitPropsOf = (dto: WorkspaceEntryDto): GitCatalogProps => {
	if (dto.isGitRepo === undefined) return {};
	return { isGitRepo: dto.isGitRepo, isBareRepo: dto.isBareRepo, hasGitmodules: dto.hasGitmodules };
};

export default class FileStructure {
	private _events = createEventEmitter<FSEvents>();
	private _collisionMovements = new WeakMap<Catalog, CollisionMovement[]>();
	private _backend: FileStructureBackend;

	constructor(
		private _fp: MountFileProvider,
		private _isReadOnly: boolean,
		knownWorkspacePaths: string[] = [],
		backend?: FileStructureBackend,
	) {
		this._backend = backend ?? resolveFileStructureBackend(_fp, knownWorkspacePaths);
	}

	get backend(): FileStructureBackend {
		return this._backend;
	}

	/**
	 * Exact names, matching what `findDocroot` and the Rust scan accept. The loose regexp this used
	 * also matched e.g. `my-root.yaml`, so editing such a file made `Workspace` reload a catalog whose
	 * doc-root the scan could not then resolve.
	 */
	static isCatalog(path: Path): boolean {
		return (DOC_ROOT_FILENAMES as readonly string[]).includes(path.nameWithExtension);
	}

	static getCatalogPath(catalog: BaseCatalog): Path {
		return new Path(catalog.name);
	}

	/** Top-level directories of a workspace that may hold a catalog. */
	static async getCatalogDirs(fp: FileProvider): Promise<FileInfo[]> {
		const items = await fp.getItems(Path.empty);
		const predicate = (i: FileInfo) =>
			i.isDirectory() && !i.name.startsWith(".") && !FS_EXCLUDE_CATALOG_NAMES.includes(i.name);
		return items.filter(predicate);
	}

	get fp() {
		return this._fp;
	}

	get events() {
		return this._events;
	}

	@trace({ level: Level.Internal, omitResult: true })
	async getCatalogEntries(): Promise<CatalogEntry[]> {
		const entries = await this._backend.scanWorkspace();
		const out = await entries.mapAsync((entry) => this._makeEntryFromWorkspace(entry));
		return out.filter(Boolean);
	}

	private async _makeEntryFromWorkspace(dto: WorkspaceEntryDto): Promise<CatalogEntry> {
		const dirPath = new Path(dto.relPath);
		const initProps = gitPropsOf(dto);

		// A bare repo has no working copy on disk — the scan only sees `.git/`, which it excludes, so
		// the doc-root is invisible to it. Reread through the mount: emitting the entry event there
		// mounts the git provider first, and the doc-root search then runs against the git tree.
		if (dto.isBareRepo && !dto.docrootRel) return await this.getCatalogEntryByPath(dirPath, true, initProps);

		await this._events.emit("before-catalog-entry-read", { path: dirPath, checkIsExists: true, initProps });

		const docrootPath = dirPath.join(new Path(dto.docrootRel ?? DOC_ROOT_FILENAME));
		const props: CatalogProps = dto.docrootRel ? dto.catalogProps : this._defaultProps(dirPath);
		const entry = this._makeCatalogEntry(dirPath, docrootPath, { ...initProps, ...props });

		await this._events.emit("catalog-entry-read", { entry });
		return entry;
	}

	@trace({ level: Level.Internal })
	async getCatalogByPath(path: Path, checkIsExists = true): Promise<Catalog> {
		const initProps: CatalogProps = {};
		// Mount the git provider first (bare repos) so the scan below resolves `at(path)` to it and
		// reads the doc-root straight from the tree — a bare repo has no working copy on disk, only
		// `.git/`, so a pre-mount disk scan would find nothing.
		await this._events.emit("before-catalog-entry-read", { path, checkIsExists, initProps });

		if (checkIsExists) await this._assertReadable(path);

		const tree = await this._backend.scanCatalog(path);
		const entry = this._makeEntryFromTree(path, tree, initProps);

		await this._events.emit("catalog-entry-read", { entry });
		return await this._hydrateCatalogFromTree(entry, tree);
	}

	@trace({ level: Level.Internal })
	async getCatalogEntryByPath(path: Path, checkIsExists = true, initProps: CatalogProps = {}): Promise<CatalogEntry> {
		await this._events.emit("before-catalog-entry-read", { path, checkIsExists, initProps });

		const docroot = await findDocroot(this._fp, path);

		if (checkIsExists && !(docroot || (await this.fp.exists(path)))) return;

		const props: CatalogProps = docroot ? await this._parseYaml(docroot) : this._defaultProps(path);
		const docrootPath = docroot ?? path.join(new Path(DOC_ROOT_FILENAME));
		const entry = this._makeCatalogEntry(path, docrootPath, { ...initProps, ...props });

		await this._events.emit("catalog-entry-read", { entry });
		return entry;
	}

	private _makeCatalogEntry(basePath: Path, docrootPath: Path, props: CatalogProps): CatalogEntry {
		return new CatalogEntry({
			name: basePath.nameWithExtension,
			rootCaterogyRef: this._fp.getItemRef(docrootPath),
			basePath,
			props: normalizeCatalogProps(props),
			load: (entry) => this._getCatalogByEntry(entry),
			isReadOnly: this._isReadOnly,
			fs: this,
		});
	}

	@trace({ level: Level.Internal })
	async createCatalog(props: CatalogEditProps, base?: Path): Promise<Catalog> {
		const url = new Path(props.url);
		const path = base ? url.join(base) : url;
		delete props.url;

		// A catalog born after this feature starts with automatic LFS on; a cloned or pre-existing
		// one has no `lfs` key and stays off until its owner turns it on.
		if (!props.lfs) props.lfs = { auto: true, exclude: [] };

		await this._fp.mkdir(path);
		// The only doc-root write that skips `ExcludedProps`, and it is safe because `props` comes
		// from the create form rather than from a scan. Route scan props through here and the git
		// flags leak back into the file.
		await this._fp.write(path.join(new Path(DOC_ROOT_FILENAME)), this._serializeProps(props));

		const entry = await this.getCatalogEntryByPath(url);
		return await entry.load();
	}

	async createCategory(
		path: Path,
		parent: Category,
		article?: { props: ArticleProps; content: string },
		catalog?: Catalog,
	): Promise<Category> {
		const shouldWriteIndex =
			!catalog?.props?.optionalCategoryIndex ||
			article?.content ||
			(article?.props && Object.values(article.props).filter(Boolean).length);

		shouldWriteIndex
			? await this._fp.write(path, article ? this.serialize(article) : "")
			: await this._fp.mkdir(path.parentDirectoryPath);

		return await this.makeCategory(path.parentDirectoryPath, parent, catalog, shouldWriteIndex ? path : null);
	}

	async createArticle(path: Path, parent: Category, initProps?: ArticleProps, catalog?: Catalog): Promise<Article> {
		const { props, content } = this.parseMarkdown(await this._fp.read(path));

		const stat = await this._fp.getStat(path);
		const article = await this.makeArticleByProps(path, initProps || props, content, parent, stat.mtimeMs, catalog);

		return article;
	}

	async moveArticle(article: Article, path: Path): Promise<void> {
		await this._fp.move(article.ref.path, path);
	}

	async moveCategory(category: Category, path: Path): Promise<void> {
		await this._fp.move(category.ref.path.parentDirectoryPath, path);
	}

	async saveCatalog(catalog: BaseCatalog): Promise<void> {
		const props = catalog.props;
		delete (props as { link?: unknown }).link;

		const propsToSave = { ...props };
		ExcludedProps.forEach((key) => delete propsToSave[key]);

		const text = this._serializeProps(propsToSave);
		await this._fp.write(catalog.getRootCategoryRef().path, text);
		catalog.repo?.resetCachedStatus();
	}

	@trace({ level: Level.Internal })
	async saveArticle(path: Path, content: string, props: ArticleProps): Promise<void> {
		const mutable = { content, props };
		await this.events.emit("item-serialize", { mutable });
		const text = this.serialize({ props: mutable.props, content: mutable.content });
		await this._fp.write(path, text);
	}

	async makeArticleByProps(
		path: Path,
		props: ArticleProps,
		content: string,
		parent: Category,
		lastModified: number,
		catalog?: Catalog,
	): Promise<Article> {
		const articleCodeInCategory = parent.folderPath.subDirectory(path).stripDotsAndExtension;
		const logicPath = Path.join(parent.logicPath, articleCodeInCategory);

		return await this._createArticleByProps(props ?? {}, parent, path, logicPath, content, lastModified, catalog);
	}

	/** Builds an article that already has its content in hand — a fresh one, or one just moved. */
	private async _createArticleByProps(
		props: ArticleProps,
		parent: Category,
		path: Path,
		logicPath: string,
		content: string,
		lastModified?: number,
		catalog?: Catalog,
	): Promise<Article> {
		const mutable = { content, props };
		await this.events.emit("item-read", { catalog, mutable });

		const article = new Article({
			ref: this._fp.getItemRef(path),
			parent,
			fs: this,
			lastModified: lastModified || 0,
			content: mutable.content,
			logicPath,
			props: mutable.props,
		});

		const mutableItem = { item: article };
		this.events.emitSync("before-item-create", { catalog, mutableItem });

		return mutableItem.item;
	}

	async makeCategory(path: Path, parent: Category, catalog: Catalog, indexPath?: Path): Promise<Category> {
		const parsed = indexPath ? this.parseMarkdown(await this._fp.read(indexPath)) : { props: {}, content: "" };

		const mutable = { props: parsed.props, content: parsed.content };
		await this.events.emit("item-read", { catalog, mutable });

		return await this._makeCategoryByProps(mutable.props, path, mutable.content, parent, catalog, indexPath);
	}

	parseMarkdown(content: string): MarkdownProps {
		let md: matter.GrayMatterFile<string>;
		try {
			md = matter(content, {});
			if (md.data && typeof md.data !== "object") throw "Wrong format";
		} catch (e) {
			console.error("Invalid matter in markdown", content, e);
			return { props: {}, content: "" };
		}
		return { props: md.data as ArticleProps, content: md.content.trim() };
	}

	serialize(props: MarkdownProps): string {
		return `---\n${this._serializeProps(props.props)}---\n\n${props.content}`;
	}

	/**
	 * A branch merge/sync can leave both `foo.md` (article) and `foo/_index.md` (category) in one
	 * parent directory — same logical name, duplicate logicPath, ambiguous links. Healing is only
	 * legal on a writable on-disk catalog: never for a read-only file structure, a git-tree
	 * (revision) provider, or static/cli environments.
	 */
	private _canHealCollisions(catalogBasePath: Path): boolean {
		if (this._isReadOnly) return false;
		const env = getExecutingEnvironment();
		if (env === "static" || env === "cli") return false;
		const fp = this._fp.at(catalogBasePath);
		return fp.kind !== "git" && !fp.isReadOnly;
	}

	/**
	 * Heals one article/category name collision (`foo.md` next to `foo/_index.md`). If the category
	 * index has no own body, the article (frontmatter + content) is folded into `foo/_index.md` and
	 * `foo.md` is deleted; otherwise the category wins the name and the article is renamed to a
	 * unique sibling name. The resulting path movement is recorded so link repointing can run once
	 * the catalog is fully hydrated (see the `catalog-collision-healed` event). Mutates disk;
	 * callers must check `_canHealCollisions` first.
	 */
	private async _healArticleCategoryCollision(
		articlePath: Path,
		categoryIndexPath: Path,
		catalog: Catalog,
	): Promise<{ action: "fold" } | { action: "rename"; newArticlePath: Path }> {
		if (await this._categoryIndexHasNoContent(categoryIndexPath)) {
			// Fold the article's body into the section index, but keep the section's own frontmatter
			// (`order`/`title` on `foo/_index.md` may legitimately diverge from `foo.md` after a
			// merge/sync). The article's props only fill keys the section doesn't set, so structural
			// data on the section side is never silently overwritten.
			const article = this.parseMarkdown(await this._fp.read(articlePath));
			const index = this.parseMarkdown(await this._fp.read(categoryIndexPath));
			const merged = { props: { ...article.props, ...index.props }, content: article.content };
			await this._fp.write(categoryIndexPath, this.serialize(merged));
			await this._fp.delete(articlePath);
			this._pushCollisionMovement(catalog, { oldPath: articlePath, newPath: categoryIndexPath });
			addEvent("collision-fold", Level.Internal, { article: articlePath.value, index: categoryIndexPath.value });
			return { action: "fold" };
		}

		const parentDir = articlePath.parentDirectoryPath;
		const siblings = (await this._fp.readdir(parentDir)).map((name) => name.replace(/\.md$/, ""));
		const newName = uniqueName(articlePath.name, siblings);
		const newArticlePath = parentDir.join(new Path(`${newName}.md`));
		await this._fp.move(articlePath, newArticlePath);
		this._pushCollisionMovement(catalog, { oldPath: articlePath, newPath: newArticlePath });
		addEvent("collision-rename", Level.Internal, { article: articlePath.value, renamed: newArticlePath.value });
		return { action: "rename", newArticlePath };
	}

	/** No own content = missing index or a body that is empty/whitespace (frontmatter-only counts as empty). */
	private async _categoryIndexHasNoContent(indexPath: Path): Promise<boolean> {
		if (!(await this._fp.exists(indexPath))) return true;
		const raw = await this._fp.read(indexPath);
		try {
			return !matter(raw ?? "", {}).content.trim();
		} catch {
			// unparsable frontmatter — never treat as empty, a fold would destroy it
			return false;
		}
	}

	private _pushCollisionMovement(catalog: Catalog, movement: CollisionMovement): void {
		const movements = this._collisionMovements.get(catalog);
		if (movements) movements.push(movement);
		else this._collisionMovements.set(catalog, [movement]);
	}

	private async _emitCollisionHealed(catalog: Catalog): Promise<void> {
		const movements = this._collisionMovements.get(catalog);
		if (!movements?.length) return;
		this._collisionMovements.delete(catalog);
		await this._events.emit("catalog-collision-healed", { fs: this, catalog, movements });
	}

	private async _getCatalogByEntry(entry: CatalogEntry): Promise<Catalog> {
		assert(entry, "cannot resolve catalog from entry; entry is undefined");

		const docrootRel = entry.props.docrootIsNoneExistent
			? null
			: (entry.basePath.subDirectory(entry.getRootCategoryRef().path)?.value ?? null);

		// Same guard as `getCatalogByPath`: an entry outlives the directory it was read from, and a
		// catalog opened after its directory was removed would otherwise hydrate as empty.
		await this._assertReadable(entry.basePath);

		const tree = await this._backend.scanCatalog(entry.basePath, { docrootRel });

		return await this._hydrateCatalogFromTree(entry, tree);
	}

	/**
	 * Scanning a path that is gone yields an empty tree, not an error, and the caller would then
	 * register an empty catalog over a live one — `Workspace._reloadCatalog` reloads by path and would
	 * wipe the very catalog it was refreshing. Only `getCatalogByPath` offers an opt-out, which
	 * `ScopedCatalogs` takes because a git-scoped path has no on-disk directory by design; loading a
	 * catalog from an entry always checks.
	 *
	 * It deliberately resolves through mounts, and that is load-bearing: a version-scoped catalog
	 * (`mycat:releases%2Fv1.0`) fails `exists`, which answers from the root disk mount, and passes only
	 * because `findDocroot` reads through the mounted git provider. Both checks are required.
	 */
	private async _assertReadable(path: Path): Promise<void> {
		if (await this._fp.exists(path)) return;
		if (await findDocroot(this._fp, path)) return;
		throw new Error(`cannot read catalog: nothing at '${path.value}'`);
	}

	private _bindCatalogEvents(catalog: Catalog) {
		catalog.events.on("item-moved", (args) => this.events.emit("item-moved", args));
		catalog.events.on("item-created", (args) => this.events.emit("item-created", args));
		catalog.events.on("item-deleted", (args) => this.events.emit("item-deleted", args));
		catalog.events.on("item-props-updated", (args) => this.events.emit("item-props-updated", args));
		catalog.events.on("item-order-updated", (args) => this.events.emit("item-order-updated", args));
	}

	private _makeEntryFromTree(basePath: Path, tree: CatalogTreeDto, initProps: CatalogProps): CatalogEntry {
		const docrootPath = basePath.join(new Path(tree.docrootRel ?? DOC_ROOT_FILENAME));
		const props: CatalogProps = tree.docrootRel ? tree.catalogProps : this._defaultProps(basePath);
		return this._makeCatalogEntry(basePath, docrootPath, { ...initProps, ...props });
	}

	@trace({ level: Level.Internal, omitArgs: true, omitResult: true })
	private async _hydrateCatalogFromTree(entry: CatalogEntry, tree: CatalogTreeDto): Promise<Catalog> {
		const rootCategory = new Category({
			ref: this._fp.getItemRef(entry.getRootCategoryRef().path),
			parent: null,
			content: null,
			props: entry.props,
			items: [],
			logicPath: entry.name,
			directory: entry.getRootCategoryDirectoryPath(),
			fs: this,
			lastModified: 0,
		});

		const catalog = new Catalog({
			name: entry.name,
			root: rootCategory,
			rootCaterogyRef: rootCategory.ref,
			basePath: entry.basePath,
			fs: this,
			fp: this._fp.at(entry.basePath) as FileProvider,
			isReadOnly: this._isReadOnly,
		});

		const rootMutable = { item: rootCategory };
		this.events.emitSync("before-item-create", { catalog, mutableItem: rootMutable });

		await this._hydrateChildren(tree.children, rootCategory, catalog, entry.basePath);

		catalog.bindItemEvents();
		this._bindCatalogEvents(catalog);

		await this._emitCollisionHealed(catalog);

		await this.events.emit("catalog-read", { fs: this, catalog });

		return catalog;
	}

	private async _hydrateChildren(
		children: NodeDto[],
		parent: Category,
		catalog: Catalog,
		basePath: Path,
	): Promise<void> {
		const resolvedChildren = await this._healCollisions(children, catalog, basePath);
		for (const child of resolvedChildren) {
			if (child.kind === "article") {
				const article = await this._hydrateArticle(child, parent, catalog, basePath);
				if (!article) continue;

				const passFilter = await this._events.emit("item-filter", {
					fs: this,
					catalogProps: catalog.props,
					parent,
					item: article,
				});
				if (passFilter) parent.items.push(article);
				continue;
			}

			if (!child.hasIndex && !catalog.props.optionalCategoryIndex) {
				await this._hydrateChildren(child.children, parent, catalog, basePath);
				continue;
			}

			const category = await this._hydrateCategory(child, parent, catalog, basePath);
			if (!category) continue;

			const passFilter = await this._events.emit("item-filter", {
				fs: this,
				catalogProps: catalog.props,
				parent,
				item: category,
			});
			if (!passFilter) continue;

			const passCategoryFilter = await this._events.emit("category-filter", {
				fs: this,
				catalogProps: catalog.props,
				parent,
				item: category,
			});

			if (passCategoryFilter) {
				parent.items.push(category);
				continue;
			}

			const orders = parent.items.map((i) => i.order);
			category.items.reduce((prev, item) => {
				item.props.order = roundedOrderAfter(orders, prev);
				return item.props.order;
			}, category.order);
			parent.items.push(...category.items);
		}

		await parent.sortItems("no-sort");
	}

	/** Resolves article/category name collisions among sibling nodes of a scanned tree. */
	private async _healCollisions(children: NodeDto[], catalog: Catalog, basePath: Path): Promise<NodeDto[]> {
		const categories = new Map<string, CategoryNodeDto>();
		for (const child of children) {
			if (child.kind === "category" && child.hasIndex) categories.set(new Path(child.directory).name, child);
		}
		if (!categories.size) return children;

		const out: NodeDto[] = [];
		for (const child of children) {
			if (child.kind !== "article") {
				out.push(child);
				continue;
			}

			const relPath = new Path(child.relPath);
			const categoryNode = categories.get(relPath.name);
			if (!categoryNode || !this._canHealCollisions(catalog.basePath)) {
				out.push(child);
				continue;
			}

			const indexPath = basePath.join(new Path(categoryNode.relPath));
			const healed = await this._healArticleCategoryCollision(basePath.join(relPath), indexPath, catalog);
			if (healed.action === "fold") {
				categoryNode.frontMatter = this.parseMarkdown(await this._fp.read(indexPath)).props;
				continue;
			}

			child.relPath = relPath.parentDirectoryPath.join(new Path(healed.newArticlePath.nameWithExtension)).value;
			out.push(child);
		}
		return out;
	}

	private async _hydrateArticle(
		node: ArticleNodeDto,
		parent: Category,
		catalog: Catalog,
		basePath: Path,
	): Promise<Article | null> {
		const absPath = basePath.join(new Path(node.relPath));
		const articleCodeInCategory = parent.folderPath.subDirectory(absPath).name;
		const logicPath = Path.join(parent.logicPath, articleCodeInCategory);

		if (node.parseError)
			addEvent("frontmatter-parse-failed", Level.Internal, { path: node.relPath, error: node.parseError });

		const mutable = { content: "", props: node.frontMatter as ArticleProps };
		await this.events.emit("item-read", { catalog, mutable });

		const article = new Article({
			ref: this._fp.getItemRef(absPath),
			parent,
			fs: this,
			lastModified: 0,
			content: null,
			props: mutable.props,
			logicPath,
		});

		const mutableItem = { item: article };
		this.events.emitSync("before-item-create", { catalog, mutableItem });

		return mutableItem.item as Article;
	}

	private async _hydrateCategory(
		node: CategoryNodeDto,
		parent: Category,
		catalog: Catalog,
		basePath: Path,
	): Promise<Category | null> {
		const indexPath = node.hasIndex ? basePath.join(new Path(node.relPath)) : null;
		const folderPath = basePath.join(new Path(node.directory));
		const logicPath = Path.join(
			parent.logicPath,
			indexPath
				? parent.ref.path.parentDirectoryPath.subDirectory(indexPath.parentDirectoryPath).value
				: folderPath.name,
		);

		const mutable = { content: "", props: node.frontMatter as CategoryProps };
		await this.events.emit("item-read", { catalog, mutable });

		const category = new Category({
			ref: this._fp.getItemRef(indexPath ?? folderPath.join(new Path(CATEGORY_ROOT_FILENAME))),
			parent,
			content: null,
			props: mutable.props,
			logicPath,
			directory: folderPath,
			items: [],
			lastModified: 0,
			fs: this,
		});

		await this._hydrateChildren(node.children, category, catalog, basePath);

		const mutableItem = { item: category };
		this.events.emitSync("before-item-create", { catalog, mutableItem });

		if (!node.hasIndex) category.props.shouldBeCreated = true;

		return mutableItem.item as Category;
	}

	private async _makeCategoryByProps(
		props: CategoryProps,
		path: Path,
		content: string,
		parent: Category,
		catalog: Catalog,
		indexPath?: Path,
	): Promise<Category> {
		const logicPath = Path.join(
			parent.logicPath,
			indexPath
				? parent.ref.path.parentDirectoryPath.subDirectory(indexPath.parentDirectoryPath).value
				: path.name,
		);

		const category = new Category({
			ref: this._fp.getItemRef(indexPath ?? path.join(new Path(CATEGORY_ROOT_FILENAME))),
			parent,
			content,
			props,
			logicPath,
			directory: path,
			items: [],
			lastModified: 0,
			fs: this,
		});
		await this._hydrateChildren(await this._backend.scanDirectory(path), category, catalog, path);

		const mutableItem = { item: category };
		this.events.emitSync("before-item-create", { catalog, mutableItem });

		return mutableItem.item;
	}

	private async _parseYaml(path: Path): Promise<CatalogProps> {
		try {
			// A sequence is valid YAML and still not props — same rule both backends apply.
			const props = yaml.load(await this._fp.read(path));
			return props && typeof props === "object" && !Array.isArray(props) ? props : {};
		} catch (e) {
			console.error("yaml invalid", e);
			return {};
		}
	}

	private _defaultProps(path: Path): CatalogProps {
		return {
			title: path.name,
			optionalCategoryIndex: true,
			docrootIsNoneExistent: true,
		};
	}

	private _serializeProps(props: FSProps): string {
		const p = Object.fromEntries(Object.entries(props).filter(([, v]) => !!v));
		delete p.welcome;
		if (p.lang === resolveLanguage()) delete p.lang;
		// Keys keep the position they were read in — no reordering. The scan hands props over in
		// file order, so rewriting an untouched article reproduces its frontmatter byte for byte
		// instead of showing up as a spurious diff (gram-ax/gramax#879). A prop that is genuinely
		// new lands last, which is where JS puts a freshly assigned key.
		return yaml.dump(p, { quotingType: '"' });
	}
}
