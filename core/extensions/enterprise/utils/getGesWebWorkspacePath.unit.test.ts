import { getGesWebWorkspacePath } from "./getGesWebWorkspacePath";

const workspaces = [
	{ path: "/local", name: "Local" },
	{ path: "/ges", name: "GES", enterprise: { gesUrl: "https://ges.example" } },
	{ path: "/other-ges", name: "Other GES", enterprise: { gesUrl: "https://other.example" } },
];

describe("getGesWebWorkspacePath", () => {
	test("selects only the workspace belonging to the active GES in web editor", () => {
		expect(getGesWebWorkspacePath("web", "https://ges.example", workspaces)).toBe("/ges");
	});

	test("does not force a GES workspace in the desktop editor", () => {
		expect(getGesWebWorkspacePath("tauri", "https://ges.example", workspaces)).toBeUndefined();
	});
});
