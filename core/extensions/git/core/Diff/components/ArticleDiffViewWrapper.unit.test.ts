/** biome-ignore-all lint/style/useNamingConvention: Jest ESM mock markers */
import type { ArticleDiffData } from "@core/SitePresenter/types/ArticlePage";
import type SideBarData from "@ext/git/actions/Publish/model/SideBarData";
import ArticleDiffViewWrapper from "@ext/git/core/Diff/components/ArticleDiffViewWrapper";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";

let mockCurrentSideBarData: SideBarData;
const mockFetchDiffData = jest.fn();

jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	__esModule: true,
	default: { value: { setArticleContent: () => "" } },
}));

jest.mock("@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider", () => ({
	useCatalogPropsStore: (selector: (state: unknown) => unknown) => selector({ data: { name: "catalog" } }),
}));

jest.mock("@ext/git/actions/Revisions/logic/hooks/useIsRevision", () => ({
	useIsRevision: () => false,
}));

jest.mock("@ext/git/core/Diff/logic/hooks/useFetchDiffData", () => ({
	__esModule: true,
	default:
		({ newPath }: { newPath: string }) =>
		() =>
			mockFetchDiffData(newPath),
}));

jest.mock("@ext/git/core/Diff/logic/hooks/useResetArticleView", () => ({
	useResetArticleView: () => undefined,
}));

jest.mock("@ext/git/core/Diff/components/store/DiffViewModeStore", () => ({
	setDiffEnabled: () => undefined,
	setDoublePanelLocked: () => undefined,
	setSideBarData: (data: SideBarData) => {
		mockCurrentSideBarData = data;
	},
	useSideBarData: () => mockCurrentSideBarData,
}));

jest.mock("@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService", () => ({
	__esModule: true,
	default: { addListener: () => undefined, removeListener: () => undefined },
}));

jest.mock("@ext/git/actions/Publish/logic/PublishEmitter", () => ({
	PublishEmitter: {
		events: { on: () => Symbol(), off: () => undefined },
	},
}));

jest.mock("@ext/git/core/Diff/components/LoadingWithDiffBottomBar", () => {
	const { createElement } = jest.requireActual<typeof import("react")>("react");
	return { __esModule: true, default: () => createElement("div", null, "loading") };
});

jest.mock("@ext/git/core/Diff/components/ArticleDiffModeView", () => {
	const { createElement } = jest.requireActual<typeof import("react")>("react");
	return {
		__esModule: true,
		default: ({
			articlePath,
			newEditTree,
		}: {
			articlePath: string;
			newEditTree: { attrs?: { source?: string } };
		}) => createElement("div", { "data-testid": "diff-article" }, `${articlePath}:${newEditTree.attrs?.source}`),
	};
});

const createDiffData = (articlePath: string): ArticleDiffData => {
	const sideBarData: SideBarData = {
		isResource: false,
		pathname: `catalog/${articlePath}`,
		data: {
			title: articlePath,
			isChanged: true,
			resources: [],
			isChecked: true,
			filePath: { path: articlePath, oldPath: articlePath },
			status: FileStatus.modified,
		},
	};

	return { sideBarData, scope: null, oldScope: "HEAD" };
};

const createFetchedData = (articlePath: string) => ({
	newData: { content: `new:${articlePath}`, editTree: { type: "doc", attrs: { source: articlePath } } },
	oldData: { content: `old:${articlePath}`, editTree: { type: "doc", attrs: { source: articlePath } } },
});

describe("ArticleDiffViewWrapper", () => {
	beforeEach(() => {
		mockFetchDiffData.mockImplementation(async (articlePath: string) => createFetchedData(articlePath));
	});

	test("loads the newly selected article without remounting the wrapper", async () => {
		const view = render(
			createElement(ArticleDiffViewWrapper, { data: createDiffData("first.md"), isReadOnly: false }),
		);
		expect((await screen.findByTestId("diff-article")).textContent).toBe("first.md:first.md");

		view.rerender(createElement(ArticleDiffViewWrapper, { data: createDiffData("second.md"), isReadOnly: false }));

		expect((await screen.findByTestId("diff-article")).textContent).toBe("second.md:second.md");
	});

	test("ignores a previous article response that finishes after the current article", async () => {
		let resolveFirstArticle: (data: ReturnType<typeof createFetchedData>) => void;
		mockFetchDiffData.mockImplementation((articlePath: string) =>
			articlePath === "first.md"
				? new Promise((resolve) => {
						resolveFirstArticle = resolve;
					})
				: Promise.resolve(createFetchedData(articlePath)),
		);

		const view = render(
			createElement(ArticleDiffViewWrapper, { data: createDiffData("first.md"), isReadOnly: false }),
		);
		view.rerender(createElement(ArticleDiffViewWrapper, { data: createDiffData("second.md"), isReadOnly: false }));
		expect((await screen.findByTestId("diff-article")).textContent).toBe("second.md:second.md");

		await act(async () => resolveFirstArticle(createFetchedData("first.md")));

		expect(screen.getByTestId("diff-article").textContent).toBe("second.md:second.md");
	});
});
