import { CATEGORY_ROOT_FILENAMES, DOC_ROOT_FILENAMES } from "@app/config/const";

/**
 * Files a catalog is read *through* rather than files it holds: git parses `.gitattributes` and
 * `.gitignore`, Gramax parses the doc-root and the category roots to find the catalog and build its
 * tree. Behind an LFS pointer a lazy clone hands the parser the pointer text instead, and the
 * catalog stops loading — so no mask may ever cover them, whatever the patterns say.
 */
const SERVICE_FILENAMES: ReadonlySet<string> = new Set([
	".gitattributes",
	".gitignore",
	...DOC_ROOT_FILENAMES,
	...CATEGORY_ROOT_FILENAMES,
]);

/** `relPath` is relative to the catalog root. Matched by name: all of these also live in subdirectories. */
const isLfsServiceFile = (relPath: string): boolean => SERVICE_FILENAMES.has(relPath.split("/").pop() ?? relPath);

export default isLfsServiceFile;
