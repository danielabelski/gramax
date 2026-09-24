export type TccCategory = "desktop" | "documents" | "downloads" | "icloud";

/** Segments under `/Users/<name>/`, longest first so iCloud is not read as a bare `Library`. */
const HOME_CATEGORIES: [string[], TccCategory][] = [
	[["Library", "Mobile Documents"], "icloud"],
	[["Desktop"], "desktop"],
	[["Documents"], "documents"],
	[["Downloads"], "downloads"],
];

/** `realpath` on APFS resolves a home directory through this firmlink; same folders either way. */
const DATA_VOLUME_PREFIX = ["System", "Volumes", "Data"];

/** Not a home directory — `/Users/Shared/Documents` is nobody's protected Documents folder. */
const SHARED_USER = "Shared";

const startsWith = (segments: string[], prefix: string[]): boolean =>
	prefix.every((segment, i) => segments[i] === segment);

/**
 * The category whose toggle in Privacy & Security → Files and Folders governs `path`.
 *
 * macOS gates categories, not paths: the pane shows Gramax one row per category, named after the
 * category rather than the directory the user picked. Naming the right one is the difference
 * between "allow access to this directory" (which toggle?) and "allow the Documents folder".
 *
 * `null` whenever the category is not certain — a wrong toggle sends the user somewhere that has
 * nothing to do with their directory, which is worse than the generic message. That is why
 * `/Volumes` is absent: it holds removable drives, network shares and plain extra internal
 * volumes, which are three different answers (or none), and the path alone does not say which.
 */
const tccCategory = (path: string | undefined): TccCategory | null => {
	// A relative path names nothing we can reason about, and a `..` could climb out of the
	// category the prefix appears to match.
	if (!path?.startsWith("/") || path.split("/").includes("..")) return null;

	let segments = path.split("/").filter(Boolean);
	if (startsWith(segments, DATA_VOLUME_PREFIX)) segments = segments.slice(DATA_VOLUME_PREFIX.length);

	if (segments[0] !== "Users" || segments[1] === SHARED_USER || segments.length < 3) return null;

	const underHome = segments.slice(2);
	return HOME_CATEGORIES.find(([prefix]) => startsWith(underHome, prefix))?.[1] ?? null;
};

export default tccCategory;
