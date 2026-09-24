import type { Section } from "@core/SitePresenter/SitePresenter";
import {
	getScopesByMode,
	getSearchMode,
	initialScopeByMode,
	nextSearchScope,
} from "@ext/serach/components/model/searchScope";
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";

const section = (view: WorkspaceView) => ({ view }) as Section;

describe("getSearchMode", () => {
	it("is section inside a workspace folder, even on the home page", () => {
		expect(getSearchMode(section(WorkspaceView.folder), false)).toBe("section");
		expect(getSearchMode(section(WorkspaceView.folder), true)).toBe("section");
	});

	it("is homepage outside a folder when on the home page", () => {
		expect(getSearchMode(undefined, true)).toBe("homepage");
		expect(getSearchMode(section(WorkspaceView.section), true)).toBe("homepage");
	});

	it("is catalog otherwise", () => {
		expect(getSearchMode(undefined, false)).toBe("catalog");
	});
});

describe("getScopesByMode", () => {
	it("lists every scope of the mode", () => {
		expect(getScopesByMode("catalog", false)).toEqual(["all", "catalog", "article"]);
		expect(getScopesByMode("section", false)).toEqual(["all", "folder"]);
		expect(getScopesByMode("homepage", false)).toEqual([]);
	});

	it("drops the cross-catalog scope on static", () => {
		expect(getScopesByMode("catalog", true)).toEqual(["catalog", "article"]);
		expect(getScopesByMode("section", true)).toEqual(["folder"]);
		expect(getScopesByMode("homepage", true)).toEqual([]);
	});
});

describe("nextSearchScope", () => {
	it("walks the catalog scopes in a cycle", () => {
		expect(nextSearchScope("catalog", "catalog", false)).toBe("article");
		expect(nextSearchScope("catalog", "article", false)).toBe("all");
		expect(nextSearchScope("catalog", "all", false)).toBe("catalog");
	});

	it("toggles the two section scopes", () => {
		expect(nextSearchScope("section", "folder", false)).toBe("all");
		expect(nextSearchScope("section", "all", false)).toBe("folder");
	});

	it("skips the unavailable scopes on static", () => {
		expect(nextSearchScope("catalog", "catalog", true)).toBe("article");
		expect(nextSearchScope("catalog", "article", true)).toBe("catalog");
		expect(nextSearchScope("section", "folder", true)).toBe("folder");
	});

	it("has nowhere to go on the home page", () => {
		expect(nextSearchScope("homepage", "all", false)).toBe(initialScopeByMode.homepage);
		expect(nextSearchScope("homepage", "all", true)).toBe(initialScopeByMode.homepage);
	});
});
