import type ClientGitBranchData from "@ext/git/actions/Branch/model/ClientGitBranchData";
import type GitBranchData from "@ext/git/core/GitBranch/model/GitBranchData";
import { getExistingBranchNames, splitBranches } from "./branchSelectors";

const branch = (name: string) => ({ name }) as ClientGitBranchData;

describe("splitBranches", () => {
	it("keeps the checked out branch in the original order", () => {
		const result = splitBranches({
			branches: [branch("feature"), branch("master")],
			currentBranch: branch("master"),
			query: "",
		});

		expect(result.current.name).toBe("master");
		expect(result.branches.map((b) => b.name)).toEqual(["feature", "master"]);
	});

	it("falls back to the current branch data when it is missing from the list", () => {
		const result = splitBranches({
			branches: [branch("feature")],
			currentBranch: { name: "detached" } as GitBranchData,
			query: "",
		});

		expect(result.current.name).toBe("detached");
		expect(result.branches.map((b) => b.name)).toEqual(["feature", "detached"]);
	});

	it("filters both the current branch and the rest by the query, ignoring case and padding", () => {
		const result = splitBranches({
			branches: [branch("master"), branch("Feature/One"), branch("other")],
			currentBranch: branch("master"),
			query: "  FEATURE ",
		});

		expect(result.current).toBeNull();
		expect(result.branches.map((b) => b.name)).toEqual(["Feature/One"]);
	});

	it("has no current branch when it is unknown", () => {
		const result = splitBranches({ branches: [branch("feature")], currentBranch: null, query: "" });

		expect(result.current).toBeNull();
		expect(result.branches.map((b) => b.name)).toEqual(["feature"]);
	});
});

describe("getExistingBranchNames", () => {
	it("adds the current branch name once", () => {
		expect(getExistingBranchNames([branch("master"), branch("feature")], branch("master"))).toEqual([
			"master",
			"feature",
		]);
		expect(getExistingBranchNames([branch("feature")], branch("master"))).toEqual(["feature", "master"]);
	});

	it("skips the unknown current branch", () => {
		expect(getExistingBranchNames([branch("feature")], null)).toEqual(["feature"]);
	});
});
