import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import WorkspaceComponent from "./WorkspaceComponent";

const mockWorkspace = {
	name: "Workspace",
	git: { source: { url: "https://git.example", type: "GitLab", repos: null }, lfs: { patterns: [] } },
	wordTemplates: [],
	pdfTemplates: [],
};

function mockMarker(text: string) {
	return () => createElement("div", null, text);
}

jest.mock("@core-ui/hooks/useCheck", () => () => true);
jest.mock("@ext/enterprise/components/admin/contexts/SettingsContext", () => ({
	useSettings: () => ({
		settings: { workspace: mockWorkspace, resources: [] },
		ensureLoaded: jest.fn(),
		getTabError: jest.fn(),
		isInitialLoading: () => false,
		isRefreshing: () => false,
	}),
}));
jest.mock("@ext/enterprise/components/admin/settings/workspace/hooks/useWorkspaceSettings", () => ({
	useWorkspaceSettings: () => ({
		localSettings: mockWorkspace,
		setLocalSettings: jest.fn(),
		isSaving: false,
		handleInputChange: jest.fn(),
		handleSave: jest.fn(),
		saveError: {},
	}),
}));
jest.mock("../../hooks/useTabGuard", () => ({ useTabGuard: jest.fn() }));
jest.mock("../../ui-kit/SettingsPageLayout", () => ({
	SettingsPageLayout: ({ children }: { children: ReactNode }) =>
		require("react").createElement("div", null, children),
}));
jest.mock("./components/WorkspaceInfo", () => ({ WorkspaceInfoDefault: mockMarker("workspace-info") }));
jest.mock("./components/repositories/WorkspaceRepositories", () => ({
	WorkspaceRepositories: mockMarker("workspace-repositories"),
}));
jest.mock("./components/lfs/WorkspaceLfs", () => ({ WorkspaceLfs: mockMarker("workspace-lfs") }));
jest.mock("./components/WorkspaceStyling", () => ({ WorkspaceStyling: mockMarker("workspace-styling") }));
jest.mock("./components/WorkspaceTemplateUploads", () => ({
	WorkspaceTemplateUploads: mockMarker("workspace-templates"),
}));

test("does not show sections settings in GES admin", () => {
	render(createElement(WorkspaceComponent));

	expect(screen.queryByText("workspace-sections")).toBeNull();
	expect(screen.getByText("workspace-info")).toBeTruthy();
});
