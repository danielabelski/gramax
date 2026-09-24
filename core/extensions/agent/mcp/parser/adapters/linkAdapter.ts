import { CATEGORY_ROOT_FILENAME } from "@app/config/const";
import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type { Item } from "@core/FileStructue/Item/Item";
import { compareSyntax, Syntax } from "@ext/markdown/core/edit/logic/Formatter/Formatters/typeFormats/model/Syntax";
import linkCreator from "@ext/markdown/elements/link/render/logic/linkCreator";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import { agentConfig } from "../../../core/agentConfig";
import type { AttachmentPath } from "../../utils/attachment";
import type { ArticleAdapter, ArticleAdapterContext } from "./adapter";

const MARKDOWN_LINK_RE = /(!?)\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*(<[^<>]*>|[^()\s]*)((?:\s+"[^"]*")?)\s*\)/g;
const MARKDOWN_LINK_MARKER = "](";
const MARKDOWN_EXTENSION = ".md";
const CATEGORY_ROOT_SUFFIX = `/${CATEGORY_ROOT_FILENAME}`;

type LinkTarget = { catalog: Catalog; item: Item };

export class LinkAdapter implements ArticleAdapter {
	async expandToAgentView(storageMarkdown: string, context: ArticleAdapterContext): Promise<string> {
		const wm = context.app.wm;
		const articlePath = LinkAdapter._articlePath(context);

		return LinkAdapter._replaceArticleLinks(storageMarkdown, (path) =>
			LinkAdapter._toAgentHref(wm, articlePath, path),
		);
	}

	async applyAgentViewToStorage(agentMarkdown: string, context: ArticleAdapterContext): Promise<string> {
		const wm = context.app.wm;
		const articlePath = LinkAdapter._articlePath(context);
		const spelling = await LinkAdapter._collectSpelling(wm, await context.item.getContent(), articlePath);
		const syntax = (await LinkAdapter._getCatalogOf(wm, articlePath))?.props.syntax;

		return LinkAdapter._replaceArticleLinks(
			agentMarkdown,
			(path) => LinkAdapter._toStorageHref(wm, articlePath, path, syntax, spelling),
			"storage",
		);
	}

	static toAgentItemPath(itemPath: string): string {
		const normalized = LinkAdapter._normalize(itemPath);
		if (normalized === CATEGORY_ROOT_FILENAME) return "";
		if (normalized.endsWith(CATEGORY_ROOT_SUFFIX)) {
			const dir = normalized.slice(0, -CATEGORY_ROOT_SUFFIX.length);
			return dir ? `${dir}/` : "";
		}
		if (normalized.endsWith(MARKDOWN_EXTENSION)) return normalized.slice(0, -MARKDOWN_EXTENSION.length);
		return normalized;
	}

	static toGramaxItemPath(itemPath: string): string {
		const agentPath = LinkAdapter.toAgentItemPath(itemPath);
		if (!agentPath || agentPath.endsWith("/")) {
			const dir = agentPath.replace(/\/+$/, "");
			return dir ? `${dir}${CATEGORY_ROOT_SUFFIX}` : CATEGORY_ROOT_FILENAME;
		}
		return `${agentPath}${MARKDOWN_EXTENSION}`;
	}

	static isCategory(itemPath: string): boolean {
		const agentPath = LinkAdapter.toAgentItemPath(itemPath);
		return !agentPath || agentPath.endsWith("/");
	}

	static async toChat(markdown: string, wm: WorkspaceManager): Promise<string> {
		return LinkAdapter._replaceArticleLinks(markdown, (path) => LinkAdapter._getPathname(wm, path), "chat");
	}

	static toAgentFileHref(articlePath: Path, absolute: Path): string {
		const agentPrefix = LinkAdapter._agentPathOf(articlePath);
		const articleDir = `${articlePath.parentDirectoryPath.value}/`;
		const filePart = absolute.value.startsWith(articleDir)
			? absolute.value.slice(articleDir.length)
			: articlePath.parentDirectoryPath.getRelativePath(absolute).value.replace(/^\.\//, "");
		return `${agentPrefix}${LinkAdapter._resourceMarker()}${filePart}`;
	}

	static fromAgentFileHref(agentHref: string): string | null {
		const resource = LinkAdapter.parseResourceHref(
			LinkAdapter._splitHash(LinkAdapter._unwrapAngle(agentHref)).path,
		);
		if (!resource) return null;
		const resourceDir = new Path(LinkAdapter.toGramaxItemPath(resource.articleItemPath)).parentDirectoryPath;
		return new Path(resource.catalogName).join(resourceDir).join(new Path(resource.resourceName)).value;
	}

	static toAgentAttachmentItemPath(name: string): string {
		return `${agentConfig.attachmentPrefix}/${new Path(name).nameWithExtension.replace(/[/\\]/g, "_")}`;
	}

	static parseResourceHref(href: string): Extract<AttachmentPath, { kind: "resource" }> | null {
		const normalized = LinkAdapter._normalize(href);
		if (!normalized || linkCreator.isExternalLink(normalized)) return null;

		const marker = LinkAdapter._resourceMarker();
		const markerIndex = normalized.indexOf(marker);
		if (markerIndex === -1) return null;

		const left = normalized.slice(0, markerIndex);
		const resourceName = normalized.slice(markerIndex + marker.length);
		if (!left || !resourceName) return null;

		const ext = new Path(resourceName).extension?.toLowerCase();
		if (!ext || ext === MARKDOWN_EXTENSION.slice(1)) return null;

		const slashIndex = left.indexOf("/");
		const catalogName = slashIndex === -1 ? left : left.slice(0, slashIndex);
		const articleItemPath = slashIndex === -1 ? "" : left.slice(slashIndex + 1);
		if (!catalogName) return null;

		return { kind: "resource", catalogName, articleItemPath, resourceName };
	}

	static async toExternal(markdown: string, wm: WorkspaceManager, domain: string): Promise<string> {
		return LinkAdapter._replaceArticleLinks(markdown, async (path) => {
			const pathname = await LinkAdapter._getPathname(wm, path);
			if (!pathname || !domain) return pathname;
			return `${domain}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
		});
	}

	private static async _toAgentHref(
		wm: WorkspaceManager,
		articlePath: Path,
		storageHref: string,
	): Promise<string | null> {
		const absolute = LinkAdapter._fromArticle(articlePath, storageHref);
		const target = await LinkAdapter._resolve(wm, absolute);
		if (target) return LinkAdapter._agentPath(target);

		const ext = new Path(LinkAdapter._splitHash(storageHref).path).extension?.toLowerCase();
		if (!ext || ext === articlePath.extension?.toLowerCase()) return null;

		return LinkAdapter.toAgentFileHref(articlePath, absolute);
	}

	private static async _toStorageHref(
		wm: WorkspaceManager,
		articlePath: Path,
		agentHref: string,
		syntax: Syntax | undefined,
		spelling: Map<string, string>,
	): Promise<string | null> {
		const original = spelling.get(agentHref);
		if (original) return original;

		const workspacePath = LinkAdapter.fromAgentFileHref(agentHref);
		if (workspacePath) {
			return articlePath.getRelativePath(new Path(workspacePath)).value;
		}

		const agentPath = LinkAdapter._asWorkspacePath(agentHref);
		if (!agentPath) return null;

		const target = await LinkAdapter._resolve(wm, agentPath);
		if (target) return LinkAdapter._toRelative(articlePath, target.item.ref.path, syntax);

		const catalog = await LinkAdapter._getCatalogOf(wm, agentPath);
		if (!catalog) return null;
		return LinkAdapter._toRelative(articlePath, new Path(LinkAdapter.toGramaxItemPath(agentPath.value)), syntax);
	}

	private static async _getPathname(wm: WorkspaceManager, path: string): Promise<string | null> {
		const agentPath = LinkAdapter._asWorkspacePath(path);
		if (!agentPath) return null;

		const target = await LinkAdapter._resolve(wm, agentPath);
		if (!target) return null;
		return (await target.catalog.getPathname(target.item)) || null;
	}

	private static _agentPathOf(articlePath: Path): string {
		const catalogName = articlePath.rootDirectory.removeExtraSymbols.value;
		const itemPath = LinkAdapter.toAgentItemPath(articlePath.value.slice(catalogName.length + 1));
		return itemPath ? `${catalogName}/${itemPath}` : catalogName;
	}

	private static async _resolve(wm: WorkspaceManager, absolute: Path): Promise<LinkTarget | null> {
		const catalog = await LinkAdapter._getCatalogOf(wm, absolute);
		if (!catalog) return null;

		for (const candidate of LinkAdapter._candidates(absolute)) {
			const item = catalog.findItemByItemPath(candidate);
			if (item) return { catalog, item };
		}
		return null;
	}

	private static async _collectSpelling(
		wm: WorkspaceManager,
		storageMarkdown: string,
		articlePath: Path,
	): Promise<Map<string, string>> {
		const spelling = new Map<string, string>();
		await LinkAdapter._replaceArticleLinks(storageMarkdown, async (path) => {
			const agentHref = await LinkAdapter._toAgentHref(wm, articlePath, path);
			if (agentHref && !spelling.has(agentHref)) spelling.set(agentHref, path);
			return null;
		});
		return spelling;
	}

	private static async _getCatalogOf(wm: WorkspaceManager, absolute: Path): Promise<Catalog | null> {
		const name = absolute.rootDirectory.removeExtraSymbols.value;
		if (!name) return null;
		try {
			return (await wm.current().getContextlessCatalog(name)) ?? null;
		} catch {
			return null;
		}
	}

	private static async _replaceArticleLinks(
		markdown: string,
		replace: (path: string) => Promise<string | null>,
		mode: "agent" | "storage" | "chat" = "agent",
	): Promise<string> {
		if (!markdown.includes(MARKDOWN_LINK_MARKER)) return markdown;

		const parts: string[] = [];
		let lastIndex = 0;
		const linkRe = new RegExp(MARKDOWN_LINK_RE.source, "g");

		let match = linkRe.exec(markdown);
		while (match !== null) {
			const [full, bang, title, rawHref, mdTitle = ""] = match;
			parts.push(markdown.slice(lastIndex, match.index));

			const href = LinkAdapter._unwrapAngle(rawHref);
			if (LinkAdapter._isArticleLink(href, bang === "!")) {
				const { path, hash } = LinkAdapter._splitHash(href);
				const needsAngle = (dest: string) => /[\s<>]/.test(dest) || dest.includes("(") || dest.includes(")");
				const wrap = (dest: string) => (needsAngle(dest) ? `<${dest}>` : dest);
				const next = path ? await replace(path) : null;
				if (next === null) {
					const dest = `${path}${hash}`;
					parts.push(mode === "chat" ? `[${title}](${wrap(dest)}${mdTitle})` : full);
				} else {
					const dest = `${next}${hash}`;
					parts.push(`[${title}](${wrap(dest)}${mdTitle})`);
				}
			} else {
				parts.push(full);
			}

			lastIndex = match.index + full.length;
			match = linkRe.exec(markdown);
		}

		parts.push(markdown.slice(lastIndex));
		return parts.join("");
	}

	private static _unwrapAngle(href: string): string {
		const trimmed = href.trim();
		return trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed.slice(1, -1) : trimmed;
	}

	private static _isArticleLink(href: string, isImage: boolean): boolean {
		if (isImage || !href) return false;
		return !linkCreator.isExternalLink(href);
	}

	private static _splitHash(href: string): { path: string; hash: string } {
		const index = href.indexOf("#");
		if (index === -1) return { path: href, hash: "" };
		return { path: href.slice(0, index), hash: href.slice(index) };
	}

	private static _agentPath(target: LinkTarget): string {
		const itemPath = LinkAdapter.toAgentItemPath(target.catalog.getRepositoryRelativePath(target.item.ref).value);
		return itemPath ? `${target.catalog.name}/${itemPath}` : `${target.catalog.name}/`;
	}

	private static _articlePath(context: ArticleAdapterContext): Path {
		return new Path(context.item.ref.path.value);
	}

	private static _fromArticle(articlePath: Path, href: string): Path {
		return articlePath.parentDirectoryPath.join(new Path(href));
	}

	private static _asWorkspacePath(href: string): Path | null {
		const normalized = LinkAdapter._normalize(href);
		if (normalized.includes(LinkAdapter._resourceMarker())) return null;
		if (normalized.startsWith(".")) return null;
		return new Path(LinkAdapter.toAgentItemPath(href));
	}

	private static _resourceMarker(): string {
		return `${agentConfig.resourcePrefix}/`;
	}

	private static _normalize(input: string): string {
		return input
			.trim()
			.replace(/^[/\\]+/, "")
			.replace(/\\/g, "/");
	}

	private static _candidates(absolute: Path): Path[] {
		const value = absolute.value.replace(/\/+$/, "");
		return [
			new Path(value),
			new Path(`${value}${MARKDOWN_EXTENSION}`),
			new Path(`${value}${CATEGORY_ROOT_SUFFIX}`),
		];
	}

	private static _toRelative(articlePath: Path, targetPath: Path, syntax: Syntax): string {
		const relative = articlePath.getRelativePath(targetPath);
		return compareSyntax(syntax, Syntax.github) ? relative.value : relative.stripExtension;
	}
}
