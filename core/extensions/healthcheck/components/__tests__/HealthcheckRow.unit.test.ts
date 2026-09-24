import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Article } from "@core/FileStructue/Article/Article";
import type ContextualCatalog from "@core/FileStructue/Catalog/ContextualCatalog";
import type { CatalogError, CatalogErrors } from "@ext/healthcheck/logic/Healthcheck";
import { render } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

jest.mock("@ext/localization/locale/translate", () => {
	const en = require("@ext/localization/locale/locale.en").default;
	return {
		// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
		__esModule: true,
		default: (key: string) => en[key] ?? key,
	};
});

jest.mock("@ext/markdown/elements/code/render/component/Code", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: ({ children }: { children: string }) =>
		require("react").createElement("code", { "data-qa": "healthcheck-code" }, children),
}));

jest.mock("@components/Breadcrumbs/LinksBreadcrumb", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));

jest.mock("@components/Actions/GoToArticle", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: ({ trigger }: { trigger: ReactNode }) => require("react").createElement("a", null, trigger),
}));

jest.mock("@components/Atoms/Icon", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));

jest.mock("@components/Atoms/Tooltip", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: ({ children }: { children: ReactNode }) => require("react").createElement("span", null, children),
}));

jest.mock("@core-ui/HigherOrderComponent/IsReadOnlyHOC", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));

jest.mock("@core-ui/hooks/usePlatform", () => ({
	usePlatform: () => ({ isTauri: false }),
}));

const brokenLinkItem = {
	props: {},
	logicPath: "cat/guide",
	getTitle: () => "Guide",
	ref: { path: { value: "guide.md" } },
	parsedContent: {
		read: async (fn: (content: unknown) => unknown) =>
			fn({
				parsedContext: {
					getLinkManager: () => ({ linkResources: [], resources: [new Path("missing.md")] }),
					getResourceManager: () => ({
						resources: [],
						exists: () => false,
						getAbsolutePath: (path: Path) => path,
					}),
					icons: [],
				},
				renderTree: null,
				tocItems: [],
			}),
	},
} as unknown as Article;

// The real checker is the producer of both groups' rows — the point of the test is
// that the aliases group ends up structurally identical to a sibling group.
const runHealthcheck = async (): Promise<CatalogErrors> => {
	const Healthcheck = require("@ext/healthcheck/logic/Healthcheck").default;
	const healthcheck = new Healthcheck(
		{} as FileProvider,
		{
			props: {},
			ctx: { contentLanguage: "en", user: { type: "base" } },
			getContentItems: () => [brokenLinkItem],
			getCategories: () => [],
			findArticle: () => undefined,
			customProviders: {
				iconProvider: { getIconByCode: async () => null },
				commentProvider: { getComments: async () => null, isAssigned: () => true },
			},
			getPathnameData: (item: Article) => ({ catalogName: "cat", itemLogicPath: item.logicPath }),
			deref: {
				aliases: {
					diagnostics: () => [{ kind: "duplicate", path: "cat/legacy", winner: "cat/new", loser: "cat/old" }],
				},
				relativeLogicPath: (logicPath: string) => logicPath.replace(/^cat\//, ""),
			},
		} as unknown as ContextualCatalog,
	);

	return healthcheck.checkCatalog();
};

const renderGroup = (type: string, title: string, data: CatalogError[]) => {
	const { ResourceErrorComponent } = require("../Healthcheck");
	return render(
		createElement(ResourceErrorComponent, {
			data,
			errorGroup: { type, title },
			goToArticleOnClick: () => {},
			itemLinks: [],
		}),
	);
};

const cellShape = (container: HTMLElement) =>
	Array.from(container.querySelector("tbody > tr")?.children ?? []).map(
		(cell) => `${cell.tagName}.${cell.className}`,
	);

describe("aliases block is structurally consistent with sibling blocks (#915)", () => {
	test("both blocks put their value in the shared Code primitive", async () => {
		const errors = await runHealthcheck();

		const links = renderGroup("links", "incorrects-paths", errors.links);
		const aliases = renderGroup("aliases", "incorrects-aliases", errors.aliases);

		expect(links.container.querySelectorAll("[data-qa='healthcheck-code']")).toHaveLength(1);
		expect(
			Array.from(aliases.container.querySelectorAll("[data-qa='healthcheck-code']")).map((c) => c.textContent),
		).toEqual(["legacy"]);
	});

	test("both blocks build the same row cells", async () => {
		const errors = await runHealthcheck();

		expect(cellShape(renderGroup("aliases", "incorrects-aliases", errors.aliases).container)).toEqual(
			cellShape(renderGroup("links", "incorrects-paths", errors.links).container),
		);
	});

	test("the alias reason is a separate hint naming the article that wins the alias", async () => {
		const errors = await runHealthcheck();

		const { container } = renderGroup("aliases", "incorrects-aliases", errors.aliases);
		const hint = container.querySelector(".value-hint");

		expect(hint?.textContent).toBe("Taken by new — the path will not work here");
	});
});
