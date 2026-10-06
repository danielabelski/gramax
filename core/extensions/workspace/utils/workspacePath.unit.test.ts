import { isWorkspacePathTaken, suggestWorkspacePath } from "@ext/workspace/utils/workspacePath";

// macOS and Windows file systems ignore case: `Gramax/workspace` and `gramax/workspace` are one folder
const taken = ["/Users/user/Documents/gramax/workspace"];

describe("workspacePath", () => {
	it("suggests a free path when an existing one differs only in case", () => {
		expect(suggestWorkspacePath("/Users/user/Documents/Gramax", taken)).toBe(
			"/Users/user/Documents/Gramax/workspace-2",
		);
	});

	it("keeps the default path when nothing collides", () => {
		expect(suggestWorkspacePath("/Users/user/Documents/Gramax", [])).toBe("/Users/user/Documents/Gramax/workspace");
	});

	it("treats a path that differs only in case as taken", () => {
		expect(isWorkspacePathTaken("/Users/user/Documents/Gramax/workspace", taken)).toBe(true);
	});

	it("accepts a different path", () => {
		expect(isWorkspacePathTaken("/Users/user/Documents/Gramax/so-load", taken)).toBe(false);
	});
});
