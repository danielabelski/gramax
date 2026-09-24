import Path from "@core/FileProvider/Path/Path";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import { Syntax } from "@ext/markdown/core/edit/logic/Formatter/Formatters/typeFormats/model/Syntax";
import type { ArticleAdapterContext } from "./adapter";
import { LinkAdapter } from "./linkAdapter";

const DOCS_ITEMS = ["docs/intro.md", "docs/guides/_index.md", "docs/guides/setup.md", "docs/guides/api-doc.md"];
const OTHER_ITEMS = ["other/handbook.md"];

const createCatalog = (name: string, itemPaths: string[], syntax?: Syntax) => ({
	name,
	props: { syntax },
	findItemByItemPath: (itemPath: Path) =>
		itemPaths.includes(itemPath.value) ? { ref: { path: new Path(itemPath.value) }, getTitle: () => "" } : null,
	getRepositoryRelativePath: (ref: { path: Path }) => new Path(ref.path.value.slice(name.length + 1)),
	getPathname: async (item: { ref: { path: Path } }) => `/-/-/-/-/${item.ref.path.value}`,
});

const createWorkspaceManager = (syntax?: Syntax) => {
	const catalogs: Record<string, unknown> = {
		docs: createCatalog("docs", DOCS_ITEMS, syntax),
		other: createCatalog("other", OTHER_ITEMS, syntax),
	};
	return { current: () => ({ getContextlessCatalog: async (name: string) => catalogs[name] ?? null }) } as never;
};

const createContext = (storageBody: string, syntax?: Syntax): ArticleAdapterContext =>
	({
		item: {
			type: ItemType.article,
			props: {},
			ref: { path: new Path("docs/guides/setup.md") },
			getContent: async () => storageBody,
		},
		catalog: { name: "docs" },
		app: { wm: createWorkspaceManager(syntax) },
		ctx: {},
		commands: {},
	}) as never;

const linkAdapter = new LinkAdapter();

describe("LinkAdapter.expandToAgentView", () => {
	const expand = (source: string) => linkAdapter.expandToAgentView(source, createContext(source));

	test("markdown without links is unchanged", async () => {
		expect(await expand("# Title\n\nplain text")).toBe("# Title\n\nplain text");
	});

	test("relative link becomes catalogName/itemPath", async () => {
		expect(await expand("[Введение](./../intro)")).toBe("[Введение](docs/intro)");
	});

	test("link with extension resolves to the same item path", async () => {
		expect(await expand("[Введение](./../intro.md)")).toBe("[Введение](docs/intro)");
	});

	test("category link resolves through _index.md", async () => {
		expect(await expand("[Руководства](./)")).toBe("[Руководства](docs/guides/)");
	});

	test("cross catalog link resolves into the other catalog", async () => {
		expect(await expand("[Справочник](./../../other/handbook)")).toBe("[Справочник](other/handbook)");
	});

	test("anchor survives the transform", async () => {
		expect(await expand("[Шаг](./../intro#step-1)")).toBe("[Шаг](docs/intro#step-1)");
	});

	test("file next to the article becomes agent format", async () => {
		expect(await expand("[EPIC.pdf](./EPIC.pdf)")).toBe("[EPIC.pdf](docs/guides/setup@resources/EPIC.pdf)");
	});

	test("file link with spaces becomes agent format from angle-bracket storage", async () => {
		expect(await expand("[audio](<./Стандартная запись 4.mp3>)")).toBe(
			"[audio](<docs/guides/setup@resources/Стандартная запись 4.mp3>)",
		);
	});

	test("markdown link title is kept out of the href", async () => {
		expect(await expand('[Введение](./../intro "intro title")')).toBe('[Введение](docs/intro "intro title")');
	});

	test("unknown target is left untouched", async () => {
		expect(await expand("[Нет](./../missing)")).toBe("[Нет](./../missing)");
	});

	test("path starting with the letters api is not treated as an external link", async () => {
		expect(await expand("[a](./api-doc)")).toBe("[a](docs/guides/api-doc)");
	});

	test("external links of every kind are left untouched", async () => {
		const source = "[a](https://gramax.io/docs) [b](mailto:a@b.c) [c](#section) [d](?query=1) [e](/api/resource)";
		expect(await expand(source)).toBe(source);
	});

	test("images are left untouched", async () => {
		expect(await expand("![](./imgs/1.png)")).toBe("![](./imgs/1.png)");
	});

	test("file link in angle brackets without ./ becomes agent format", async () => {
		expect(await expand("[EPIC.pdf](<EPIC.pdf>)")).toBe("[EPIC.pdf](docs/guides/setup@resources/EPIC.pdf)");
	});

	test("several links in one line are all transformed", async () => {
		expect(await expand("[a](./../intro) и [b](./api-doc)")).toBe("[a](docs/intro) и [b](docs/guides/api-doc)");
	});
});

describe("LinkAdapter.applyAgentViewToStorage", () => {
	const apply = (agentMarkdown: string, storageBody = "", syntax?: Syntax) =>
		new LinkAdapter().applyAgentViewToStorage(agentMarkdown, createContext(storageBody, syntax));

	test("agent format becomes a relative path without extension", async () => {
		expect(await apply("[Введение](docs/intro)")).toBe("[Введение](./../intro)");
	});

	test("extension is kept for GitHub flavored catalogs", async () => {
		expect(await apply("[Введение](docs/intro)", "", Syntax.github)).toBe("[Введение](./../intro.md)");
	});

	test("category keeps _index in the relative path", async () => {
		expect(await apply("[Руководства](docs/guides/)")).toBe("[Руководства](./_index)");
	});

	test("cross catalog link becomes a relative path too", async () => {
		expect(await apply("[Справочник](other/handbook)")).toBe("[Справочник](./../../other/handbook)");
	});

	test("anchor survives the transform", async () => {
		expect(await apply("[Шаг](docs/intro#step-1)")).toBe("[Шаг](./../intro#step-1)");
	});

	test("original spelling of untouched links is restored", async () => {
		const storage = "[Введение](./../intro.md)";
		expect(await apply("[Введение](docs/intro) и [Шаг](docs/intro)", storage)).toBe(
			"[Введение](./../intro.md) и [Шаг](./../intro.md)",
		);
	});

	test("link to a not yet created item is computed by path arithmetic", async () => {
		expect(await apply("[Скоро](docs/guides/upcoming)")).toBe("[Скоро](./upcoming)");
	});

	test("GitHub unresolved article keeps the markdown extension", async () => {
		expect(await apply("[Скоро](docs/guides/upcoming)", "", Syntax.github)).toBe("[Скоро](./upcoming.md)");
	});

	test("GitHub unresolved category uses _index.md", async () => {
		expect(await apply("[Скоро](docs/guides/upcoming/)", "", Syntax.github)).toBe("[Скоро](./upcoming/_index.md)");
	});

	test("unknown catalog is left untouched", async () => {
		expect(await apply("[Чужое](nowhere/article)")).toBe("[Чужое](nowhere/article)");
	});

	test("agent file format becomes a relative path", async () => {
		expect(await apply("[EPIC.pdf](docs/guides/setup@resources/EPIC.pdf)")).toBe("[EPIC.pdf](./EPIC.pdf)");
	});

	test("markdown link title survives apply", async () => {
		expect(await apply('[Введение](docs/intro "intro title")')).toBe('[Введение](./../intro "intro title")');
	});

	test("agent file format with spaces becomes a relative path", async () => {
		expect(await apply("[audio.mp3](<docs/guides/setup@resources/Стандартная запись 4.mp3>)")).toBe(
			"[audio.mp3](<./Стандартная запись 4.mp3>)",
		);
	});

	test("agent file format with non-breaking spaces becomes a relative path", async () => {
		expect(await apply("[audio.mp3](<docs/guides/setup@resources/Стандартная\u00A0запись\u00A04.mp3>)")).toBe(
			"[audio.mp3](<./Стандартная\u00A0запись\u00A04.mp3>)",
		);
	});

	test("already relative link is left untouched", async () => {
		const source = "[EPIC.pdf](./EPIC.pdf) [Нет](./../missing)";
		expect(await apply(source)).toBe(source);
	});

	test("external links are left untouched", async () => {
		const source = "[a](https://gramax.io) [b](mailto:a@b.c) [c](#section)";
		expect(await apply(source)).toBe(source);
	});
});

describe("LinkAdapter round trip", () => {
	const roundTrip = async (storage: string, syntax?: Syntax) => {
		const adapter = new LinkAdapter();
		const context = createContext(storage, syntax);
		const agentView = await adapter.expandToAgentView(storage, context);
		return { agentView, storage: await adapter.applyAgentViewToStorage(agentView, context) };
	};

	test("spelling of untouched links survives the round trip", async () => {
		const source = "[Введение](./../intro.md)\n\n[Настройка](./setup)";
		const result = await roundTrip(source);
		expect(result.storage).toBe(source);
	});

	test("files, images and external links survive the round trip", async () => {
		const source = "[EPIC.pdf](./EPIC.pdf) ![](./imgs/1.png) [gramax](https://gramax.io)";
		const result = await roundTrip(source);
		expect(result.agentView).toBe(
			"[EPIC.pdf](docs/guides/setup@resources/EPIC.pdf) ![](./imgs/1.png) [gramax](https://gramax.io)",
		);
		expect(result.storage).toBe(source);
	});

	test("file link with spaces in the filename survives the round trip", async () => {
		const source = "[audio](<./Стандартная запись 4.mp3>)";
		const result = await roundTrip(source);
		expect(result.agentView).toBe("[audio](<docs/guides/setup@resources/Стандартная запись 4.mp3>)");
		expect(result.storage).toBe(source);
	});
});

describe("LinkAdapter.toChat", () => {
	const toChat = (markdown: string) => LinkAdapter.toChat(markdown, createWorkspaceManager());

	test("agent format becomes a route path", async () => {
		expect(await toChat("[Введение](docs/intro)")).toBe("[Введение](/-/-/-/-/docs/intro.md)");
	});

	test("cross catalog agent format becomes a route path", async () => {
		expect(await toChat("[Справочник](other/handbook)")).toBe("[Справочник](/-/-/-/-/other/handbook.md)");
	});

	test("anchor survives the transform", async () => {
		expect(await toChat("[Шаг](docs/intro#step-1)")).toBe("[Шаг](/-/-/-/-/docs/intro.md#step-1)");
	});

	test("empty text is returned as is", async () => {
		expect(await toChat("")).toBe("");
	});

	test("unknown target is wrapped for chat markdown", async () => {
		expect(await toChat("[Нет](docs/missing)")).toBe("[Нет](docs/missing)");
	});

	test("file link is wrapped for chat markdown", async () => {
		expect(await toChat("[EPIC.pdf](docs/guides/setup@resources/EPIC.pdf)")).toBe(
			"[EPIC.pdf](docs/guides/setup@resources/EPIC.pdf)",
		);
	});

	test("file link with spaces is wrapped for chat markdown", async () => {
		expect(await toChat("[audio](<docs/guides/setup@resources/Стандартная запись 4.mp3>)")).toBe(
			"[audio](<docs/guides/setup@resources/Стандартная запись 4.mp3>)",
		);
	});
});

describe("LinkAdapter.toExternal", () => {
	const toExternal = (markdown: string, domain: string) =>
		LinkAdapter.toExternal(markdown, createWorkspaceManager(), domain);

	test("domain is prepended to the route path", async () => {
		expect(await toExternal("[Введение](docs/intro)", "https://app.gram.ax")).toBe(
			"[Введение](https://app.gram.ax/-/-/-/-/docs/intro.md)",
		);
	});

	test("without a domain the route path is used", async () => {
		expect(await toExternal("[Введение](docs/intro)", "")).toBe("[Введение](/-/-/-/-/docs/intro.md)");
	});

	test("unknown target is left untouched", async () => {
		expect(await toExternal("[Нет](docs/missing)", "https://app.gram.ax")).toBe("[Нет](docs/missing)");
	});
});

describe("LinkAdapter.toAgentItemPath", () => {
	test("strips the markdown extension", () => {
		expect(LinkAdapter.toAgentItemPath("guides/setup.md")).toBe("guides/setup");
	});

	test("maps category index to a trailing slash", () => {
		expect(LinkAdapter.toAgentItemPath("guides/api/_index.md")).toBe("guides/api/");
		expect(LinkAdapter.toAgentItemPath("_index.md")).toBe("");
	});

	test("keeps dots inside names", () => {
		expect(LinkAdapter.toAgentItemPath("notes/v1.2-release.md")).toBe("notes/v1.2-release");
	});

	test("normalizes separators and leading slashes", () => {
		expect(LinkAdapter.toAgentItemPath("  /guides\\setup.md  ")).toBe("guides/setup");
	});
});

describe("LinkAdapter.toGramaxItemPath", () => {
	test("trailing slash selects a category, otherwise an article", () => {
		expect(LinkAdapter.toGramaxItemPath("guides/setup")).toBe("guides/setup.md");
		expect(LinkAdapter.toGramaxItemPath("guides/")).toBe("guides/_index.md");
		expect(LinkAdapter.toGramaxItemPath("guides/setup/")).toBe("guides/setup/_index.md");
		expect(LinkAdapter.toGramaxItemPath("")).toBe("_index.md");
	});

	test("accepts gramax .md and _index.md without doubling the extension", () => {
		expect(LinkAdapter.toGramaxItemPath("guides/setup.md")).toBe("guides/setup.md");
		expect(LinkAdapter.toGramaxItemPath("guides/_index.md")).toBe("guides/_index.md");
		expect(LinkAdapter.toGramaxItemPath("_index.md")).toBe("_index.md");
	});
});

describe("LinkAdapter.isCategory", () => {
	test("trailing slash marks a category", () => {
		expect(LinkAdapter.isCategory("guides/setup")).toBe(false);
		expect(LinkAdapter.isCategory("guides/setup/")).toBe(true);
		expect(LinkAdapter.isCategory("")).toBe(true);
	});

	test("_index.md is a category", () => {
		expect(LinkAdapter.isCategory("guides/_index.md")).toBe(true);
		expect(LinkAdapter.isCategory("_index.md")).toBe(true);
		expect(LinkAdapter.isCategory("guides/setup.md")).toBe(false);
	});
});

describe("LinkAdapter.toAgentFileHref", () => {
	const articlePath = new Path("docs/guides/setup.md");

	test("file next to the article", () => {
		expect(LinkAdapter.toAgentFileHref(articlePath, new Path("docs/guides/EPIC.pdf"))).toBe(
			"docs/guides/setup@resources/EPIC.pdf",
		);
	});

	test("round trip with fromAgentFileHref", () => {
		const href = LinkAdapter.toAgentFileHref(articlePath, new Path("docs/guides/EPIC.pdf"));
		expect(LinkAdapter.fromAgentFileHref(href)).toBe("docs/guides/EPIC.pdf");
	});
});

describe("LinkAdapter.fromAgentFileHref", () => {
	test("returns workspace path for article file links", () => {
		expect(LinkAdapter.fromAgentFileHref("docs/guides/setup@resources/EPIC.pdf")).toBe("docs/guides/EPIC.pdf");
	});

	test("returns workspace path for category file links", () => {
		expect(LinkAdapter.fromAgentFileHref("docs/guides/@resources/EPIC.pdf")).toBe("docs/guides/EPIC.pdf");
		expect(LinkAdapter.fromAgentFileHref("docs/guides/setup/@resources/spec.docx")).toBe(
			"docs/guides/setup/spec.docx",
		);
	});

	test("external and article links return null", () => {
		expect(LinkAdapter.fromAgentFileHref("https://gramax.io/file.pdf")).toBeNull();
		expect(LinkAdapter.fromAgentFileHref("docs/intro")).toBeNull();
		expect(LinkAdapter.fromAgentFileHref("docs/guides/EPIC.pdf")).toBeNull();
	});

	test("catalog root resource href maps to workspace path", () => {
		expect(LinkAdapter.fromAgentFileHref("docs@resources/EPIC.pdf")).toBe("docs/EPIC.pdf");
		expect(LinkAdapter.fromAgentFileHref("<docs/guides/setup@resources/EPIC.pdf>")).toBe("docs/guides/EPIC.pdf");
	});
});

describe("LinkAdapter.toAgentAttachmentItemPath", () => {
	test("builds @attachments itemPath from a filename", () => {
		expect(LinkAdapter.toAgentAttachmentItemPath("notes.txt")).toBe("@attachments/notes.txt");
	});
});
