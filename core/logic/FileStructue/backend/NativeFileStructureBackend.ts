import { CATEGORY_ROOT_FILENAMES, DOC_ROOT_FILENAMES, WORKSPACE_CONFIG_FILENAME } from "@app/config/const";
import rustCall from "@app/resolveModule/rustcall";
import type MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import type Path from "@core/FileProvider/Path/Path";
import type FileStructureBackend from "@core/FileStructue/backend/FileStructureBackend";
import type {
	CatalogTreeDto,
	NodeDto,
	ScanCatalogOptions,
	WorkspaceEntryDto,
} from "@core/FileStructue/backend/FileStructureBackend";
import { DOCROOT_SEARCH_DEPTH } from "@core/FileStructue/backend/findDocroot";
import { FS_EXCLUDE_CATALOG_NAMES, FS_EXCLUDE_FILENAMES } from "@core/FileStructue/backend/scanExcludes";
import { Level, trace } from "@ext/loggers/opentelemetry";
import type GitTreeFileProvider from "@ext/versioning/GitTreeFileProvider";

/** Scan options the Rust side takes; the two commands differ only in what they may descend into. */
type NativeScanOpts = {
	excludeDirs: string[];
	categoryIndexFilename: readonly string[];
	docrootFilenames: readonly string[];
	workspaceConfigFilename: string;
	docrootSearchDepth: number;
	maxConcurrency: number;
	followSymlinks: boolean;
	knownWorkspacePaths: string[];
};

/**
 * Reads the tree through the Rust scan (`fs.scan_workspace` / `fs.scan_catalog`). One native call
 * replaces a walk that would otherwise cost thousands of round trips across the JS/native boundary.
 *
 * Not available everywhere: `static` and `cli` ship no scan commands, so those environments get
 * {@link JsFileStructureBackend} instead — see `resolveFileStructureBackend`.
 */
export default class NativeFileStructureBackend implements FileStructureBackend {
	readonly kind = "native" as const;

	constructor(
		private _fp: MountFileProvider,
		private _knownWorkspacePaths: string[],
	) {}

	@trace({ level: Level.Internal, omitArgs: true, omitResult: true })
	async scanWorkspace(): Promise<WorkspaceEntryDto[]> {
		return await rustCall<WorkspaceEntryDto[]>("fs.scan_workspace", {
			scope: { kind: this._fp.kind, root: this._fp.rootPath.value },
			path: "",
			opts: this._opts({ excludeDirs: FS_EXCLUDE_CATALOG_NAMES, maxConcurrency: 1 }),
		});
	}

	@trace({ level: Level.Internal, omitArgs: true, omitResult: true })
	async scanCatalog(path: Path, options?: ScanCatalogOptions): Promise<CatalogTreeDto> {
		const { scope, scopedPath } = this._scopeOf(path);
		return await rustCall<CatalogTreeDto>("fs.scan_catalog", {
			scope,
			path: scopedPath,
			docrootRel: options?.docrootRel ?? null,
			opts: this._opts({ excludeDirs: FS_EXCLUDE_FILENAMES, maxConcurrency: 5 }),
		});
	}

	/**
	 * `docrootSearchDepth: 0` keeps the scan inside `dir`: with nothing to search for, the tree root
	 * stays where it was asked to start instead of shifting to a doc-root found further down.
	 */
	@trace({ level: Level.Internal, omitArgs: true, omitResult: true })
	async scanDirectory(dir: Path): Promise<NodeDto[]> {
		const { scope, scopedPath } = this._scopeOf(dir);
		const tree = await rustCall<CatalogTreeDto>("fs.scan_catalog", {
			scope,
			path: scopedPath,
			docrootRel: null,
			opts: this._opts({
				excludeDirs: FS_EXCLUDE_FILENAMES,
				maxConcurrency: 5,
				docrootSearchDepth: 0,
			}),
		});
		return tree.children;
	}

	/**
	 * A git-mounted catalog (bare repo) has no working copy on disk — only `.git/`. Its provider
	 * builds the `FsScope::Git` (repository plus tree read scope) and a tree-relative path so the
	 * Rust side reads straight from the git tree; disk providers scan from the workspace-relative path.
	 */
	private _scopeOf(path: Path): { scope: unknown; scopedPath: string } {
		const fp = this._fp.at(path);
		if (fp.kind === "git") return (fp as unknown as GitTreeFileProvider).getNativeScope(path);
		return { scope: { kind: "disk" as const, root: fp.rootPath.value }, scopedPath: path.value };
	}

	private _opts(overrides: Partial<NativeScanOpts> & Pick<NativeScanOpts, "excludeDirs">): NativeScanOpts {
		return {
			categoryIndexFilename: CATEGORY_ROOT_FILENAMES,
			docrootFilenames: DOC_ROOT_FILENAMES,
			workspaceConfigFilename: WORKSPACE_CONFIG_FILENAME,
			docrootSearchDepth: DOCROOT_SEARCH_DEPTH,
			maxConcurrency: 1,
			followSymlinks: false,
			knownWorkspacePaths: this._knownWorkspacePaths,
			...overrides,
		};
	}
}
