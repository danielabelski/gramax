import type MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import type FileStructureBackend from "@core/FileStructue/backend/FileStructureBackend";
import JsFileStructureBackend from "@core/FileStructue/backend/JsFileStructureBackend";
import NativeFileStructureBackend from "@core/FileStructue/backend/NativeFileStructureBackend";

/**
 * Every backend there is. Suites run `describe.each(BACKENDS)` so a behaviour can only be added to
 * one implementation by adding it to the other as well.
 */
export const BACKENDS = ["js", "native"] as const;

export type BackendKind = (typeof BACKENDS)[number];

export const makeBackend = (
	kind: BackendKind,
	fp: MountFileProvider,
	knownWorkspacePaths: string[] = [],
): FileStructureBackend =>
	kind === "js"
		? new JsFileStructureBackend(fp, knownWorkspacePaths)
		: new NativeFileStructureBackend(fp, knownWorkspacePaths);
