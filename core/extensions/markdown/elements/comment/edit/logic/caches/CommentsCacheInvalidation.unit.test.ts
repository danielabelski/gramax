import { createEventEmitter, type Event } from "@core/Event/EventEmitter";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type CatalogEvents from "@core/FileStructue/Catalog/CatalogEvents";
import type FileStructure from "@core/FileStructue/FileStructure";
import type { RepositoryEvents } from "@ext/git/core/Repository/Repository";
import type CommentProvider from "@ext/markdown/elements/comment/edit/logic/CommentProvider";
import CommentsCountCache from "./CommentsCountCache";
import { CommentsSearchCache } from "./CommentsSearchCache";

type FileStructureCreateEvent = Event<"before-item-create", { mutableItem: { item: unknown } }>;

const createCacheDependencies = (cacheFile: string, cacheData: string) => {
	let cacheExists = true;
	const repositoryEvents = createEventEmitter<RepositoryEvents>();
	const catalogEvents = createEventEmitter<CatalogEvents>();
	const catalog = {
		name: "notes",
		events: catalogEvents,
		repo: { events: repositoryEvents },
		findItemByItemPath: () => null,
	} as unknown as Catalog;
	const fp = {
		exists: jest.fn(async (path) => cacheExists && path.value.endsWith(cacheFile)),
		read: jest.fn(async () => cacheData),
		write: jest.fn(async () => undefined),
		delete: jest.fn(async () => {
			if (!cacheExists) throw Object.assign(new Error("already deleted"), { code: "NotFound" });
			cacheExists = false;
		}),
	} as unknown as FileProvider;
	const fs = {
		events: createEventEmitter<FileStructureCreateEvent>(),
	} as unknown as FileStructure;
	const commentProvider = {} as CommentProvider;
	const repositoryEventTokens = [
		repositoryEvents.on("checkout", (args) => catalogEvents.emit("checkout", { catalog, ...args })),
		repositoryEvents.on("sync", (args) => catalogEvents.emit("sync", { catalog, ...args })),
	];

	return { catalog, commentProvider, fp, fs, repositoryEvents, repositoryEventTokens };
};

describe("comments cache invalidation", () => {
	test("checkout does not reload the stale count cache from disk", async () => {
		const deps = createCacheDependencies(
			"comments-count.json",
			JSON.stringify({ "notes/article.md": { hash: null, comments: [["comment-id", "reviewer@example.com"]] } }),
		);
		const caches = Array.from(
			{ length: 4 },
			() => new CommentsCountCache(deps.fp, deps.fs, deps.catalog, deps.commentProvider),
		);
		const cache = caches[0];
		deps.catalog.events.emitSync("repository-set", { catalog: deps.catalog });
		deps.catalog.events.emitSync("repository-set", { catalog: deps.catalog });
		deps.catalog.events.emitSync("repository-set", { catalog: deps.catalog });

		expect(await cache.getCommentsCache()).toHaveProperty("size", 1);
		await deps.repositoryEvents.emit("checkout", { repo: deps.catalog.repo, branch: "other" });

		expect(await cache.getCommentsCache()).toHaveProperty("size", 0);
		expect(deps.fp.delete).toHaveBeenCalledTimes(4);

		const restartedCache = new CommentsCountCache(deps.fp, deps.fs, deps.catalog, deps.commentProvider);
		expect(await restartedCache.getCommentsCache()).toHaveProperty("size", 0);
	});

	test("sync does not reload the stale search cache from disk", async () => {
		const deps = createCacheDependencies(
			"comments-search.json",
			JSON.stringify({
				"notes/article.md": {
					hash: null,
					comments: [["comment-id", { content: "stale", answers: [] }]],
				},
			}),
		);
		const caches = Array.from(
			{ length: 4 },
			() => new CommentsSearchCache(deps.fp, deps.fs, deps.catalog, deps.commentProvider),
		);
		const cache = caches[0];
		deps.catalog.events.emitSync("repository-set", { catalog: deps.catalog });
		deps.catalog.events.emitSync("repository-set", { catalog: deps.catalog });
		deps.catalog.events.emitSync("repository-set", { catalog: deps.catalog });

		expect(await cache.getSearchCache()).toHaveProperty("size", 1);
		await deps.repositoryEvents.emit("sync", { repo: deps.catalog.repo, isVersionChanged: true });

		expect(await cache.getSearchCache()).toHaveProperty("size", 0);
		expect(deps.fp.delete).toHaveBeenCalledTimes(4);

		const restartedCache = new CommentsSearchCache(deps.fp, deps.fs, deps.catalog, deps.commentProvider);
		expect(await restartedCache.getSearchCache()).toHaveProperty("size", 0);
	});
});
