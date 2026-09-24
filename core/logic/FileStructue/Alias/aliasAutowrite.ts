import type { ItemProps } from "@core/FileStructue/Item/Item";
import { type AliasEntry, aliasPathOf, normalizeAliasPath } from "./AliasIndex";

export type { AliasEntry };
export { aliasPathOf };

// The single `moved` format the alias index accepts: UTC ISO-8601, whole seconds.
// Anything the frontmatter or a client round trip hands us — a Date from an unquoted YAML
// timestamp, an ISO string with milliseconds — is folded into it; garbage becomes undefined
// so the caller writes no `moved` at all rather than a value the index reports as broken.
export const canonicalMoved = (raw: unknown): string | undefined => {
	if (raw === undefined || raw === null || raw === "") return undefined;
	const date = raw instanceof Date ? raw : new Date(String(raw));
	if (Number.isNaN(date.getTime())) return undefined;
	return date.toISOString().replace(/\.\d{3}Z$/, "Z");
};

export const nowMoved = (): string => {
	return canonicalMoved(new Date());
};

export const isManualAlias = (entry: AliasEntry): boolean => {
	return typeof entry === "string";
};

export const recordMoveAlias = (props: ItemProps, from: string, to: string, moved = nowMoved()): void => {
	const fromPath = normalizeAliasPath(from);
	const toPath = normalizeAliasPath(to);
	if (!fromPath || fromPath === toPath) return;

	const entries = (Array.isArray(props.aliases) ? props.aliases : []).filter(
		(entry) => aliasPathOf(entry) !== toPath,
	);
	if (!entries.some((entry) => aliasPathOf(entry) === fromPath)) entries.push({ path: fromPath, moved });

	if (entries.length) props.aliases = entries;
	else delete props.aliases;
};

export const dropAutoAlias = (props: ItemProps, alias: string): boolean => {
	if (!Array.isArray(props.aliases)) return false;
	const target = normalizeAliasPath(alias);
	const kept = props.aliases.filter((entry) => isManualAlias(entry) || aliasPathOf(entry) !== target);
	if (kept.length === props.aliases.length) return false;
	if (kept.length) props.aliases = kept;
	else delete props.aliases;
	return true;
};

export const hasManualAlias = (props: ItemProps, alias: string): boolean => {
	if (!Array.isArray(props.aliases)) return false;
	const target = normalizeAliasPath(alias);
	return props.aliases.some((entry) => isManualAlias(entry) && aliasPathOf(entry) === target);
};
