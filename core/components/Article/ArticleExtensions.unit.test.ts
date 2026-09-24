import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import ArticleExtensions from "./ArticleExtensions";

let mockIsMobile = true;

jest.mock("@core-ui/ContextServices/ButtonStateService/ButtonStateService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { value: { conf: { ai: { enabled: false }, isReadOnly: false } } },
}));
jest.mock("@core-ui/hooks/useAudioRecorder", () => ({ isActive: () => false }));
jest.mock("@core-ui/hooks/useMediaQuery", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => mockIsMobile,
}));
jest.mock("@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider", () => ({
	useArticlePropsStore: () => undefined,
}));
jest.mock("@core-ui/stores/EditorStore", () => ({
	useEditorStore: (selector: (state: object) => unknown) => selector({ editor: null, isSmallEditor: false }),
}));
jest.mock("@ext/ai/components/Audio/AudioRecorderService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { value: { recorderState: null } },
}));
jest.mock("@ext/ai/components/Audio/Toolbar", () => ({ ArticleAudioToolbar: () => null }));
jest.mock("@ext/git/actions/Revisions/logic/hooks/useIsRevision", () => ({ useIsRevision: () => false }));
jest.mock("@ext/git/core/Diff/logic/hooks/useIsDiffView", () => ({ useIsDiffView: () => false }));
jest.mock("@ext/markdown/core/edit/components/Menu/Menus/Toolbar", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => require("react").createElement("div", { "data-testid": "toolbar-content" }),
}));
jest.mock("@ext/markdown/core/edit/logic/Toolbar/useToolbarViewport", () => ({
	useToolbarViewport: () => null,
}));

describe("ArticleExtensions", () => {
	beforeEach(() => {
		mockIsMobile = true;
	});

	it("keeps the mobile sticky toolbar in the article scroll context", () => {
		const { container } = render(
			createElement("div", { className: "article-layout" }, createElement(ArticleExtensions)),
		);

		const toolbar = screen.getByTestId("toolbar-content");
		const positionWrapper = toolbar.closest(".sticky");
		expect(container.contains(toolbar)).toBe(true);
		expect(positionWrapper).not.toBeNull();
		expect(positionWrapper?.classList.contains("fixed")).toBe(false);
	});

	it("keeps the desktop sticky toolbar in the article scroll context", () => {
		mockIsMobile = false;
		const { container } = render(
			createElement("div", { className: "article-layout" }, createElement(ArticleExtensions)),
		);

		expect(container.contains(screen.getByTestId("toolbar-content"))).toBe(true);
	});
});
