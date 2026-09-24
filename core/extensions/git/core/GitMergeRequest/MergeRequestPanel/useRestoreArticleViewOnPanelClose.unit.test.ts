/** biome-ignore-all lint/style/useNamingConvention: Jest ESM mock markers */

jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	__esModule: true,
	default: { value: { articlePath: "article.md" } },
}));
jest.mock("@core-ui/ContextServices/views/articleView/ArticleViewService", () => ({
	__esModule: true,
	default: { isDefaultView: jest.fn(), setDefaultView: jest.fn() },
}));
jest.mock("@components/Article/ArticleUpdater/ArticleUpdaterService", () => ({
	__esModule: true,
	default: { update: jest.fn() },
}));

import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import { MERGE_REQUEST_PANEL_ID } from "@ext/git/core/GitMergeRequest/constants";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import { useRestoreArticleViewOnPanelClose } from "./useRestoreArticleViewOnPanelClose";

const mockApiUrlCreator = ApiUrlCreatorService.value;
const mockIsDefaultView = ArticleViewService.isDefaultView as jest.Mock;
const mockSetDefaultView = ArticleViewService.setDefaultView as jest.Mock;
const mockUpdate = ArticleUpdaterService.update as jest.Mock;

describe("useRestoreArticleViewOnPanelClose", () => {
	beforeEach(() => {
		localStorage.clear();
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: MERGE_REQUEST_PANEL_ID, title: "Merge request" });
		mockIsDefaultView.mockReturnValue(false);
		mockUpdate.mockResolvedValue(undefined);
		(globalThis as unknown as { refreshPage: jest.Mock }).refreshPage = jest.fn().mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("restores the article after a diff was opened and the panel closes", async () => {
		renderHook(() => useRestoreArticleViewOnPanelClose());

		act(() => useFloatingPanelStore.getState().setIsOpen(MERGE_REQUEST_PANEL_ID, true));
		act(() => useFloatingPanelStore.getState().setIsOpen(MERGE_REQUEST_PANEL_ID, false));

		expect(mockSetDefaultView).toHaveBeenCalledTimes(1);
		expect(mockUpdate).toHaveBeenCalledWith(mockApiUrlCreator);
		await waitFor(() => expect(refreshPage).toHaveBeenCalledTimes(1));
	});

	it("does not reload an article that is already in its default view", () => {
		mockIsDefaultView.mockReturnValue(true);
		renderHook(() => useRestoreArticleViewOnPanelClose());

		act(() => useFloatingPanelStore.getState().setIsOpen(MERGE_REQUEST_PANEL_ID, true));
		act(() => useFloatingPanelStore.getState().setIsOpen(MERGE_REQUEST_PANEL_ID, false));

		expect(mockSetDefaultView).not.toHaveBeenCalled();
		expect(mockUpdate).not.toHaveBeenCalled();
	});
});
