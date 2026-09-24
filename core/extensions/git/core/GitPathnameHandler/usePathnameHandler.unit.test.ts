/** biome-ignore-all lint/style/useNamingConvention: expected */
import FetchService from "@core-ui/ApiServices/FetchService";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import usePathnameHandler from "@ext/git/core/GitPathnameHandler/usePathnameHandler";
import { renderHook, waitFor } from "@testing-library/react";

jest.mock("@core/Api/useRouter", () => ({
	useRouter: () => ({ hash: "", path: "/catalog/main/article", pushPath: jest.fn() }),
}));
jest.mock("@core/RouterPath/RouterPathProvider", () => ({
	__esModule: true,
	default: { isEditorPathname: () => true },
}));
jest.mock("@core-ui/ApiServices/FetchService", () => ({
	__esModule: true,
	default: { fetch: jest.fn() },
}));
jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	__esModule: true,
	default: { value: { getMergeData: () => "/merge-data" } },
}));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	__esModule: true,
	default: { value: { isArticle: true } },
}));
jest.mock("@core-ui/ContextServices/views/articleView/ArticleViewService", () => ({
	__esModule: true,
	default: { setDefaultView: jest.fn(), setLoadingView: jest.fn() },
}));
jest.mock("@core-ui/hooks/useWatch", () => ({
	__esModule: true,
	default: (callback: () => void) => callback(),
}));
jest.mock("@ext/git/actions/Revisions/logic/hooks/useIsRevision", () => ({ useIsRevision: () => false }));
jest.mock("@ext/git/core/GitPathnameHandler/checkout/logic/useOnPathnameUpdateBranch", () => ({
	__esModule: true,
	default: jest.fn(),
}));
jest.mock("@ext/storage/components/useIsSourceDataValid", () => ({
	__esModule: true,
	default: () => true,
}));
jest.mock("@ext/storage/logic/utils/useStorage", () => ({ useIsRepoOk: () => true }));

describe("usePathnameHandler", () => {
	it("keeps the rendered article visible while git state is being fetched", async () => {
		jest.mocked(FetchService.fetch).mockReturnValue(new Promise(() => undefined));

		renderHook(() => usePathnameHandler(true));

		await waitFor(() => expect(FetchService.fetch).toHaveBeenCalledWith("/merge-data"));
		expect(ArticleViewService.setLoadingView).not.toHaveBeenCalled();
	});
});
