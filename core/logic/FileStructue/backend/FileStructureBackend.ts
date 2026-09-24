import type Path from "@core/FileProvider/Path/Path";
import type { ArticleProps } from "@core/FileStructue/Article/Article";
import type { CatalogProps } from "@core/FileStructue/Catalog/CatalogProps";
import type { CategoryProps } from "@core/FileStructue/Category/Category";

/**
 * One workspace subdirectory that looks like a catalog. `docrootRel` is the doc-root file relative
 * to `relPath`, or `null` when the directory has none and the catalog runs on default props.
 *
 * The git flags are only filled by backends that can see the repository while scanning; a backend
 * that leaves them `undefined` makes `FSCatalogEntryAttachGit` probe the disk itself.
 */
export type WorkspaceEntryDto = {
	relPath: string;
	docrootRel: string | null;
	catalogProps: Partial<CatalogProps>;
	isGitRepo?: boolean;
	isBareRepo?: boolean;
	hasGitmodules?: boolean;
};

export type ArticleNodeDto = {
	kind: "article";
	relPath: string;
	frontMatter: Partial<ArticleProps>;
	parseError: string | null;
};

export type CategoryNodeDto = {
	kind: "category";
	relPath: string;
	directory: string;
	hasIndex: boolean;
	frontMatter: Partial<CategoryProps>;
	children: NodeDto[];
};

export type NodeDto = ArticleNodeDto | CategoryNodeDto;

export type CatalogTreeDto = {
	docrootRel: string | null;
	catalogProps: Partial<CatalogProps>;
	children: NodeDto[];
};

export type ScanCatalogOptions = {
	/** Doc-root relative to the catalog path. `null`/omitted makes the backend search for it. */
	docrootRel?: string | null;
};

/**
 * Reads a directory tree into the DTOs `FileStructure` hydrates catalogs from. Both implementations
 * — the Rust scan and the legacy FileProvider walk — return the same shapes, so hydration, event
 * emission and collision healing exist once, in `FileStructure`.
 */
export default interface FileStructureBackend {
	readonly kind: "native" | "js";

	/** Catalog-looking subdirectories of the workspace root. */
	scanWorkspace(): Promise<WorkspaceEntryDto[]>;

	/** Full article/category tree of one catalog. */
	scanCatalog(path: Path, options?: ScanCatalogOptions): Promise<CatalogTreeDto>;

	/**
	 * Article/category tree of a single directory, with node paths relative to that directory.
	 * Rereads a section after it moved, where the tree on disk is ahead of the tree in memory.
	 */
	scanDirectory(dir: Path): Promise<NodeDto[]>;
}
