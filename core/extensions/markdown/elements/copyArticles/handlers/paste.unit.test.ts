import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import type { ResourceServiceType } from "@core-ui/ContextServices/ResourceService/ResourceService";
import type { ClipboardOrigin } from "@ext/markdown/elements/copyArticles/handlers/clipboardOrigin";
import type { GramaxClipboardData } from "@ext/markdown/elements/copyArticles/handlers/copy";
import { createResourceIfNeed } from "@ext/markdown/elements/copyArticles/handlers/paste";
import { type Node, Schema } from "@tiptap/pm/model";

// biome-ignore lint/style/useNamingConvention: expected
jest.mock("@core-ui/ApiServices/FetchService", () => ({ __esModule: true, default: { fetch: jest.fn() } }));

const fetchMock = FetchService.fetch as jest.Mock;

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		image: { group: "block", atom: true, attrs: { src: { default: "" }, resource: { default: null } } },
		text: { group: "inline" },
	},
	marks: {},
});

const apiUrlCreator = {
	getArticleResource: (src: string, _mime: unknown, catalogName: string, itemId: string) =>
		`resource:${catalogName}:${itemId}:${src}`,
} as unknown as ApiUrlCreator;

const origin: ClipboardOrigin = { domain: "https://gramax.example", workspace: "/workspaces/a" };

const source: GramaxClipboardData["source"] = { catalogName: "docs", articlePath: "guides/source.md", origin };

const pasteResource = async (node: Node, clipboardSource = source, target = origin) =>
	(await createResourceIfNeed(
		node,
		apiUrlCreator,
		resourceService,
		{ copyPath: "docs/guides/source", source: clipboardSource } as GramaxClipboardData,
		target,
	)) as Record<string, unknown>;

let saved: { name: string; buffer: Buffer };

const resourceService = {
	setResource: async (name: string, file: Buffer) => {
		saved = { name, buffer: file };
		return `new-${name}`;
	},
} as unknown as ResourceServiceType;

/** An image node as it arrives from the clipboard: `src` holds the bytes only when the copy had them cached. */
const imageNode = (resource: Record<string, unknown>) => schema.nodes.image.create({ src: "images/pic.png", resource });

beforeEach(() => {
	jest.clearAllMocks();
	saved = undefined;
});

describe("createResourceIfNeed", () => {
	test("pastes the bytes the clipboard carried", async () => {
		const node = imageNode({ name: "images/pic.png", src: Buffer.from([1, 2, 3]).toJSON() });

		const attrs = await pasteResource(node);

		expect(attrs.src).toBe("new-images/pic.png");
		expect(saved.buffer).toEqual(Buffer.from([1, 2, 3]));
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("fetches from the source article an image whose bytes never got loaded", async () => {
		fetchMock.mockResolvedValue({ ok: true, buffer: async () => Buffer.from([4, 5, 6]) });
		const node = imageNode({ name: "images/pic.png" });

		const attrs = await pasteResource(node);

		expect(fetchMock.mock.calls[0][0]).toBe("resource:docs:guides/source.md:images/pic.png");
		expect(saved.buffer).toEqual(Buffer.from([4, 5, 6]));
		expect(attrs.src).toBe("new-images/pic.png");
	});

	test("keeps the node as it was when the source article cannot give the bytes back", async () => {
		fetchMock.mockResolvedValue({ ok: false, buffer: async () => null });
		const node = imageNode({ name: "images/pic.png" });

		const attrs = await pasteResource(node);

		expect(saved).toBeUndefined();
		expect(attrs.src).toBe("images/pic.png");
	});

	test("does not save an un-pulled Git LFS pointer as the pasted image", async () => {
		const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${"a".repeat(64)}\nsize 12345\n`;
		fetchMock.mockResolvedValue({ ok: true, buffer: async () => Buffer.from(pointer) });
		const node = imageNode({ name: "images/pic.png" });

		const attrs = await pasteResource(node);

		expect(saved).toBeUndefined();
		expect(attrs.src).toBe("images/pic.png");
	});

	test.each([
		["another workspace", { ...origin, workspace: "/workspaces/b" }],
		["another server", { ...origin, domain: "https://other.example" }],
	])("does not fetch the source from %s, where a same-named catalog may hold another file", async (_, target) => {
		fetchMock.mockResolvedValue({ ok: true, buffer: async () => Buffer.from([7, 8, 9]) });
		const node = imageNode({ name: "images/pic.png" });

		const attrs = await pasteResource(node, source, target);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(saved).toBeUndefined();
		expect(attrs.src).toBe("images/pic.png");
	});

	test("does not fetch the source of a clipboard payload that does not say where it was copied", async () => {
		fetchMock.mockResolvedValue({ ok: true, buffer: async () => Buffer.from([7, 8, 9]) });
		const node = imageNode({ name: "images/pic.png" });

		const attrs = await pasteResource(node, { catalogName: "docs", articlePath: "guides/source.md" });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(attrs.src).toBe("images/pic.png");
	});

	test("does not fetch an external address from the source article", async () => {
		fetchMock.mockResolvedValue({ ok: false, buffer: async () => null });
		const node = schema.nodes.image.create({
			src: "https://cdn.example/pic.png",
			resource: { name: "https://cdn.example/pic.png" },
		});

		const attrs = await pasteResource(node);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(attrs.src).toBe("https://cdn.example/pic.png");
	});
});
