import { configLfsPolicy, configManagesLfsPatterns } from "@core/GitLfs/logic/workspaceLfsPatterns";
import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";

const POLICY = { git: { lfs: { auto: true, exclude: ["*.psd"] } } };
const NOTHING_STATED = { git: { lfs: { patterns: ["*.png"] } } };

const ges = (rest: object = {}) => ({ enterprise: { gesUrl: "https://ges.example" }, ...rest }) as WorkspaceConfig;
const cloud = (rest: object = {}) =>
	({ enterpriseCloud: { url: "https://cloud.example" }, ...rest }) as WorkspaceConfig;
const plain = (rest: object = {}) => rest as WorkspaceConfig;

describe("configManagesLfsPatterns", () => {
	test("a workspace with masks of its own owns them", () => {
		expect(configManagesLfsPatterns({ git: { lfs: { patterns: ["*.png"] } } })).toBe(true);
	});

	test("an empty list is no ownership at all", () => {
		expect(configManagesLfsPatterns({ git: { lfs: { patterns: [] } } })).toBe(false);
		expect(configManagesLfsPatterns(undefined)).toBe(false);
	});
});

describe("configLfsPolicy", () => {
	test("a GES workspace imposes what its `git.lfs` block states", () => {
		expect(configLfsPolicy(ges(POLICY))).toEqual({ auto: true, exclude: ["*.psd"] });
	});

	test("a cloud workspace does the same", () => {
		expect(configLfsPolicy(cloud(POLICY))).toEqual({ auto: true, exclude: ["*.psd"] });
	});

	test("a plain workspace imposes nothing, however its yaml was edited", () => {
		expect(configLfsPolicy(plain(POLICY))).toEqual({});
	});

	test("an administered workspace that states nothing leaves the catalog to answer", () => {
		expect(configLfsPolicy(ges())).toEqual({});
		expect(configLfsPolicy(ges(NOTHING_STATED))).toEqual({});
		expect(configLfsPolicy(undefined)).toEqual({});
	});

	test("a switch left off is not a prohibition — the catalogs go on answering for themselves", () => {
		expect(configLfsPolicy(ges({ git: { lfs: { auto: false } } }))).toEqual({});
	});

	test("exclusions hold even with the switch off: a catalog that turns the auto-add on obeys them", () => {
		expect(configLfsPolicy(ges({ git: { lfs: { auto: false, exclude: ["*.psd"] } } }))).toEqual({
			exclude: ["*.psd"],
		});
	});
});
