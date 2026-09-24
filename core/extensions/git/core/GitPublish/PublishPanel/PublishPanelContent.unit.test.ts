/** biome-ignore-all lint/style/useNamingConvention: Jest ES module mock markers */

let mockIsPanelOpen = true;

jest.mock("@components/Article/ArticleUpdater/ArticleUpdaterService", () => ({
	__esModule: true,
	default: { update: jest.fn() },
}));
jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	__esModule: true,
	default: { value: {} },
}));
jest.mock("@core-ui/ContextServices/views/articleView/ArticleViewService", () => ({
	__esModule: true,
	default: { isDefaultView: () => true, setDefaultView: jest.fn() },
}));
jest.mock("@core-ui/hooks/diff/useSetArticleDiffView", () => ({
	__esModule: true,
	default: () => jest.fn(),
}));
jest.mock("@core-ui/hooks/useApi", () => ({
	RequestStatus: { Init: "init", Loading: "loading" },
	useApi: () => ({ data: undefined, status: "success", call: jest.fn() }),
}));
jest.mock("@core-ui/stores/ScrollPositionStore", () => ({
	useScrollPositionStore: (selector: (state: { clearAll: () => void }) => unknown) =>
		selector({ clearAll: jest.fn() }),
}));
jest.mock("@ext/git/core/Diff/components/store/DiffExtendedModeStore", () => ({
	useDiffExtendedMode: () => false,
}));
jest.mock("@ext/git/core/Diff/logic/hooks/useDiffToggle", () => ({
	useDiffToggle: () => jest.fn(),
}));
jest.mock("@ext/git/core/GitPublish/useDiscard", () => ({
	useDiscard: () => ({ discard: jest.fn() }),
}));
jest.mock("@ext/git/core/GitPublish/usePublish", () => ({
	__esModule: true,
	default: jest.fn(),
}));
jest.mock("@ext/git/core/GitPublish/usePublishDiffEntries", () => ({
	__esModule: true,
	default: jest.fn(),
}));
jest.mock("@ext/git/core/GitPublish/usePublishSelectedFiles", () => ({
	__esModule: true,
	default: () => ({
		selectedFiles: new Set(["article.md"]),
		isSelectedAll: true,
		selectFile: jest.fn(),
		selectAll: jest.fn(),
		isSelected: () => true,
		resetSelection: jest.fn(),
	}),
}));
jest.mock("@ext/localization/locale/translate", () => ({
	__esModule: true,
	default: (key: string) => key,
}));
jest.mock("@ui-kit/FloatingPanel", () => {
	const { createElement } = require("react");
	return {
		PanelEmptyState: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
		PanelEmptyStateDescription: ({ children }: { children: React.ReactNode }) => createElement("p", null, children),
		PanelEmptyStateIcon: () => null,
		PanelEmptyStateTitle: ({ children }: { children: React.ReactNode }) => createElement("h2", null, children),
		useFloatingPanelStore: (
			selector: (state: { panels: { publish: { isOpen: boolean } }; setIsOpen: () => void }) => unknown,
		) => selector({ panels: { publish: { isOpen: mockIsPanelOpen } }, setIsOpen: jest.fn() }),
	};
});
jest.mock("@ui-kit/Loader", () => ({ Loader: () => null }));
jest.mock("@ui-kit/ScrollShadowContainer", () => ({
	ScrollShadowContainer: ({ children }: { children: React.ReactNode }) =>
		require("react").createElement("div", null, children),
}));
jest.mock("./components/PublishFooter", () => ({
	PublishFooter: ({ onPublish }: { onPublish: () => void }) =>
		require("react").createElement("button", { "data-testid": "publish-footer", onClick: onPublish }),
}));
jest.mock("./components/PublishSelectAllRow", () => ({ PublishSelectAllRow: () => null }));
jest.mock("./components/PublishTree", () => ({
	PublishTree: ({ entries }: { entries: Array<{ name?: string }> }) =>
		require("react").createElement(
			"div",
			null,
			entries.map((entry) => require("react").createElement("span", { key: entry.name }, entry.name)),
		),
}));

import type { DiffTree } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import usePublish from "@ext/git/core/GitPublish/usePublish";
import usePublishDiffEntries from "@ext/git/core/GitPublish/usePublishDiffEntries";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { PublishPanelContent } from "./PublishPanelContent";

const diffTree: DiffTree = {
	overview: { added: 0, deleted: 0, modified: 1 },
	data: [
		{
			type: "item",
			name: "article.md",
			pathname: "article.md",
			logicpath: "article.md",
			filepath: { new: "article.md", old: "article.md" },
			overview: { added: 0, removed: 0, isLfs: false, size: 1, status: FileStatus.modified },
			isChanged: true,
			resources: [],
			hasChilds: false,
			indent: 0,
		},
	],
};

const mockUsePublish = usePublish as jest.MockedFunction<typeof usePublish>;
const mockUsePublishDiffEntries = usePublishDiffEntries as jest.MockedFunction<typeof usePublishDiffEntries>;

describe("PublishPanelContent", () => {
	beforeEach(() => {
		mockIsPanelOpen = true;
		mockUsePublish.mockReturnValue({
			isPublishing: false,
			message: "Update article",
			publish: jest.fn(),
			setMessage: jest.fn(),
		});
		mockUsePublishDiffEntries.mockReturnValue({
			diffTree,
			overview: diffTree.overview,
			isEntriesLoading: false,
			isEntriesReady: true,
			resetDiffTree: jest.fn(),
		});
	});

	afterEach(() => jest.clearAllMocks());

	it("keeps the previous changes visible while publishing after the current diff becomes empty", () => {
		const view = render(createElement(PublishPanelContent));

		expect(screen.getByText("article.md")).not.toBeNull();

		mockUsePublish.mockReturnValue({
			isPublishing: true,
			message: "Update article",
			publish: jest.fn(),
			setMessage: jest.fn(),
		});
		mockUsePublishDiffEntries.mockReturnValue({
			diffTree: null,
			overview: { added: 0, deleted: 0, modified: 0 },
			isEntriesLoading: false,
			isEntriesReady: true,
			resetDiffTree: jest.fn(),
		});

		view.rerender(createElement(PublishPanelContent));

		expect(screen.getByText("article.md")).not.toBeNull();
		expect(screen.queryByText("git.publish.empty-state.title")).toBeNull();
	});

	it("captures the changes before the publishing state is rendered", () => {
		const publish = jest.fn(() => new Promise<boolean>(() => undefined));
		mockUsePublish.mockReturnValue({
			isPublishing: false,
			message: "Update article",
			publish,
			setMessage: jest.fn(),
		});
		const view = render(createElement(PublishPanelContent));

		fireEvent.click(screen.getByTestId("publish-footer"));
		mockUsePublishDiffEntries.mockReturnValue({
			diffTree: null,
			overview: { added: 0, deleted: 0, modified: 0 },
			isEntriesLoading: false,
			isEntriesReady: true,
			resetDiffTree: jest.fn(),
		});
		view.rerender(createElement(PublishPanelContent));

		expect(publish).toHaveBeenCalledTimes(1);
		expect(screen.getByText("article.md")).not.toBeNull();
		expect(screen.queryByText("git.publish.empty-state.title")).toBeNull();
	});

	it("keeps the published changes visible while the panel closing animation runs", () => {
		const view = render(createElement(PublishPanelContent));

		mockIsPanelOpen = false;
		mockUsePublishDiffEntries.mockReturnValue({
			diffTree: null,
			overview: { added: 0, deleted: 0, modified: 0 },
			isEntriesLoading: false,
			isEntriesReady: true,
			resetDiffTree: jest.fn(),
		});

		view.rerender(createElement(PublishPanelContent));

		expect(screen.getByText("article.md")).not.toBeNull();
		expect(screen.queryByText("git.publish.empty-state.title")).toBeNull();
	});
});
