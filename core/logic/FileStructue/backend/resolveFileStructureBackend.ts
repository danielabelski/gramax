import { getExecutingEnvironment } from "@app/resolveModule/env";
import type MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import type FileStructureBackend from "@core/FileStructue/backend/FileStructureBackend";
import JsFileStructureBackend from "@core/FileStructue/backend/JsFileStructureBackend";
import NativeFileStructureBackend from "@core/FileStructue/backend/NativeFileStructureBackend";

/**
 * `static` and `cli` have no Rust scan behind `rustCall` — the static build answers fs commands from
 * a directory listing embedded in the page, and the CLI answers them from Node's `fs`. Both walk the
 * tree in JS; every other environment reads it natively.
 */
const resolveFileStructureBackend = (fp: MountFileProvider, knownWorkspacePaths: string[]): FileStructureBackend => {
	const env = getExecutingEnvironment();
	if (env === "static" || env === "cli") return new JsFileStructureBackend(fp, knownWorkspacePaths);
	return new NativeFileStructureBackend(fp, knownWorkspacePaths);
};

export default resolveFileStructureBackend;
