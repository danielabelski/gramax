import { CATEGORY_ROOT_FILENAMES, DOC_ROOT_FILENAMES, WORKSPACE_CONFIG_FILENAME } from "@app/config/const";
import type MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import type FileInfo from "@core/FileProvider/model/FileInfo";
import Path from "@core/FileProvider/Path/Path";
import type FileStructureBackend from "@core/FileStructue/backend/FileStructureBackend";
import type {
	ArticleNodeDto,
	CatalogTreeDto,
	CategoryNodeDto,
	NodeDto,
	ScanCatalogOptions,
	WorkspaceEntryDto,
} from "@core/FileStructue/backend/FileStructureBackend";
import findDocroot from "@core/FileStructue/backend/findDocroot";
import { FS_EXCLUDE_CATALOG_NAMES, FS_EXCLUDE_FILENAMES } from "@core/FileStructue/backend/scanExcludes";
import type { CatalogProps } from "@core/FileStructue/Catalog/CatalogProps";
import { addEvent, Level, trace } from "@ext/loggers/opentelemetry";
import matter from "gray-matter";
import * as yaml from "js-yaml";

const ARTICLE_READ_CONCURRENCY = 10;

/**
 * Windows editors write a byte order mark, and a file that starts with one still starts with
 * frontmatter as far as its author is concerned. This is load-bearing in `_readFrontMatter`, whose
 * own delimiter test runs before gray-matter gets a look: missing it makes the props parse as empty
 * and the next save writes that loss to disk. In `_readYaml` it is belt-and-braces — js-yaml strips
 * the mark itself.
 */
const stripBom = (content: string): string => (content.charCodeAt(0) === 0xfeff ? content.slice(1) : content);

const OPEN_DELIMITER = /^---[ \t]*\r?\n/;
const CLOSE_DELIMITER = /\n---[ \t]*(\r?\n|$)/;

/** One directory split into the parts a catalog tree is built from. */
type DirEntries = { index: FileInfo | null; articles: FileInfo[]; subdirs: FileInfo[] };

type FrontMatter = { frontMatter: Record<string, unknown>; parseError: string | null };

const isMarkdown = (name: string): boolean => name.endsWith(".md") || name.endsWith(".markdown");

/** Props are a YAML mapping. A scalar or a sequence parses fine and is still not props. */
const isMapping = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === "object" && !Array.isArray(value);

/**
 * Ordinal, not locale-aware: the Rust scan compares names as bytes, and a locale collation would put
 * `_1` before `1` where the native backend puts it after. Both backends must agree on child order.
 */
const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Walks the tree through the `FileProvider`, one call per directory and file.
 *
 * This is the original traversal, kept because `static` and `cli` cannot run the Rust scan: the
 * static build serves a prebuilt directory listing shipped with the page, and the CLI shells out to
 * Node's `fs`. Everywhere else `NativeFileStructureBackend` does the same job in a single call.
 */
export default class JsFileStructureBackend implements FileStructureBackend {
	readonly kind = "js" as const;

	constructor(
		private _fp: MountFileProvider,
		private _knownWorkspacePaths: string[],
	) {}

	@trace({ level: Level.Internal, omitArgs: true, omitResult: true })
	async scanWorkspace(): Promise<WorkspaceEntryDto[]> {
		const dirs = await this._catalogDirs();

		const entries = await dirs.mapAsync(async (dir): Promise<WorkspaceEntryDto> => {
			if (await this._isNestedWorkspace(dir)) return null;

			const docroot = await findDocroot(this._fp, dir.path, FS_EXCLUDE_CATALOG_NAMES);
			return {
				relPath: dir.path.value,
				docrootRel: docroot ? dir.path.subDirectory(docroot).value : null,
				catalogProps: docroot ? await this._readYaml(docroot) : {},
			};
		});

		return entries.filter(Boolean).sort((a, b) => byName(a.relPath, b.relPath));
	}

	@trace({ level: Level.Internal, omitArgs: true, omitResult: true })
	async scanCatalog(path: Path, options?: ScanCatalogOptions): Promise<CatalogTreeDto> {
		const docroot = options?.docrootRel
			? path.join(new Path(options.docrootRel))
			: await findDocroot(this._fp, path, FS_EXCLUDE_FILENAMES);

		// The tree starts next to the doc-root, not at the catalog directory: a doc-root nested in a
		// subdirectory makes that subdirectory the catalog's root.
		const rootDir = docroot ? docroot.parentDirectoryPath : path;

		return {
			docrootRel: docroot ? path.subDirectory(docroot).value : null,
			catalogProps: docroot ? await this._readYaml(docroot) : {},
			children: await this._readChildren(await this._splitEntries(rootDir), path),
		};
	}

	@trace({ level: Level.Internal, omitArgs: true, omitResult: true })
	async scanDirectory(dir: Path): Promise<NodeDto[]> {
		return await this._readChildren(await this._splitEntries(dir), dir);
	}

	/** Top-level directories that may hold a catalog; hidden and functional names never do. */
	private async _catalogDirs(): Promise<FileInfo[]> {
		const items = await this._fp.default().getItems(Path.empty);
		return items.filter(
			(i) => i.isDirectory() && !i.name.startsWith(".") && !FS_EXCLUDE_CATALOG_NAMES.includes(i.name),
		);
	}

	/**
	 * A workspace nested inside another one is its own root, not a catalog of the outer workspace —
	 * either because it carries a `workspace.yaml` or because it is already registered as one.
	 */
	private async _isNestedWorkspace(dir: FileInfo): Promise<boolean> {
		const hasWorkspaceYaml = await this._fp.exists(dir.path.join(new Path(WORKSPACE_CONFIG_FILENAME)));
		if (hasWorkspaceYaml) {
			addEvent("nested-workspace-skipped", Level.Internal, { dir: dir.name, reason: "workspace.yaml" });
			return true;
		}

		const dirAbsPath = this._fp.rootPath.join(new Path(dir.name));
		const isKnown = this._knownWorkspacePaths.some((wp) => new Path(wp).startsWith(dirAbsPath));
		if (isKnown)
			addEvent("nested-workspace-skipped", Level.Internal, { dir: dir.name, reason: "known-workspace-path" });

		return isKnown;
	}

	private async _readChildren(entries: DirEntries, basePath: Path): Promise<NodeDto[]> {
		const articles = await entries.articles.mapAsync(
			(file) => this._readArticle(file.path, basePath),
			ARTICLE_READ_CONCURRENCY,
		);
		// Sequential on purpose: `_readCategory` recurses, so an unbounded limit here compounds per
		// level — a tree five deep would have hundreds of directories in flight, each holding its own
		// article reads open. The `cli` build walks real workspaces through Node's `fs` and would hit
		// the descriptor limit. Articles above already give this backend its parallelism.
		const categories = await entries.subdirs.mapAsync((dir) => this._readCategory(dir.path, basePath), 1);

		return [...articles, ...categories.filter(Boolean)];
	}

	private async _readCategory(dir: Path, basePath: Path): Promise<CategoryNodeDto | null> {
		const entries = await this._splitEntries(dir);
		const children = await this._readChildren(entries, basePath);

		// A directory with neither an index nor anything below it is a plain folder, not a section.
		if (!entries.index && !children.length) return null;

		const indexPath = entries.index ? dir.join(new Path(entries.index.name)) : null;

		return {
			kind: "category",
			relPath: basePath.subDirectory(indexPath ?? dir).value,
			directory: basePath.subDirectory(dir).value,
			hasIndex: !!indexPath,
			frontMatter: indexPath ? (await this._readFrontMatter(indexPath)).frontMatter : {},
			children,
		};
	}

	private async _readArticle(path: Path, basePath: Path): Promise<ArticleNodeDto> {
		const { frontMatter, parseError } = await this._readFrontMatter(path);
		return { kind: "article", relPath: basePath.subDirectory(path).value, frontMatter, parseError };
	}

	/**
	 * Splits one directory into its section index, its articles and its subdirectories, applying the
	 * same exclusions and the same name sort the Rust scan applies, so both backends hand
	 * `FileStructure` the same children in the same order.
	 *
	 * One divergence is outside this file: under `cli`, `read_dir_stats` reports a symlink as
	 * `symbolic` (`app/resolveModule/rustcall/cli.ts` uses `lstat`) while the Rust scan resolves it,
	 * so a symlinked section is invisible there. Pre-existing, and changing the CLI shim's symlink
	 * semantics needs its own change.
	 */
	private async _splitEntries(dir: Path): Promise<DirEntries> {
		const entries = await this._fp.getItems(dir).catch(() => [] as FileInfo[]);

		const articles: FileInfo[] = [];
		const subdirs: FileInfo[] = [];
		let index: FileInfo | null = null;
		let indexPriority = Number.MAX_SAFE_INTEGER;

		for (const entry of entries) {
			if (FS_EXCLUDE_FILENAMES.includes(entry.name)) continue;

			if (entry.isDirectory()) {
				subdirs.push(entry);
				continue;
			}

			if ((DOC_ROOT_FILENAMES as readonly string[]).includes(entry.name)) continue;

			// Position, not just membership: the first name in the list wins when a directory somehow
			// holds more than one index file, which is how the Rust scan picks too.
			const priority = (CATEGORY_ROOT_FILENAMES as readonly string[]).indexOf(entry.name);
			if (priority !== -1) {
				if (priority < indexPriority) {
					indexPriority = priority;
					index = entry;
				}
				continue;
			}

			if (isMarkdown(entry.name)) articles.push(entry);
		}

		articles.sort((a, b) => byName(a.name, b.name));
		subdirs.sort((a, b) => byName(a.name, b.name));

		return { index, articles, subdirs };
	}

	/**
	 * Reads a markdown file's frontmatter under the same contract as the Rust scan: malformed or
	 * unterminated frontmatter yields empty props plus an error, never a partial parse.
	 */
	private async _readFrontMatter(path: Path): Promise<FrontMatter> {
		const raw = await this._fp.read(path).catch(() => "");
		const content = stripBom(raw?.toString() ?? "");

		if (!OPEN_DELIMITER.test(content)) return { frontMatter: {}, parseError: null };
		if (!CLOSE_DELIMITER.test(content.slice(content.indexOf("\n"))))
			return { frontMatter: {}, parseError: "unterminated frontmatter" };

		try {
			const data = matter(content, {}).data;
			// A sequence is valid YAML but not props. Rust's `yaml_to_json_or_empty` drops it the same
			// way — including reporting no error, since nothing failed to parse — and letting an array
			// through here would serialize back as keys `0`, `1`, ….
			if (!isMapping(data)) return { frontMatter: {}, parseError: null };
			return { frontMatter: data, parseError: null };
		} catch (e) {
			return { frontMatter: {}, parseError: String(e) };
		}
	}

	private async _readYaml(path: Path): Promise<Partial<CatalogProps>> {
		try {
			const props = yaml.load(stripBom((await this._fp.read(path)).toString()));
			return isMapping(props) ? props : {};
		} catch {
			return {};
		}
	}
}
