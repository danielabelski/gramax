import applyWorkspaceGit from "@ext/enterprise/utils/applyWorkspaceGit";

// biome-ignore lint/suspicious/noExplicitAny: the fixtures stand in for whole server payloads
const config = (value: any) => value;

const source = { type: "GitLab", url: "https://gitlab.example", repos: ["a/b"] };
const stored = config({ source, lfs: { patterns: ["*.png"] } });

describe("applyWorkspaceGit", () => {
	test("takes the LFS block from the trimmed config, where it rides at the top level", () => {
		const git = applyWorkspaceGit(stored, config({ lfs: { patterns: ["*.png"], auto: true } }));

		expect(git.lfs).toEqual({ patterns: ["*.png"], auto: true });
	});

	test("and from the full config, where it sits inside `git`", () => {
		const git = applyWorkspaceGit(stored, config({ git: { source, lfs: { auto: true } } }));

		expect(git.lfs).toEqual({ auto: true });
	});

	test("prefers `git.lfs` when the server sends both spellings", () => {
		const git = applyWorkspaceGit(stored, config({ git: { lfs: { auto: true } }, lfs: { patterns: ["*.psd"] } }));

		expect(git.lfs).toEqual({ auto: true });
	});

	test("keeps the repository source a trimmed config never mentions", () => {
		const git = applyWorkspaceGit(stored, config({ lfs: { auto: true } }));

		expect(git.source).toEqual(source);
	});

	test("drops an LFS block the workspace no longer states", () => {
		const git = applyWorkspaceGit(stored, config({}));

		expect(git.lfs).toBeUndefined();
		expect("lfs" in git).toBe(false);
		expect(git.source).toEqual(source);
	});

	test("works for a workspace that stored no git block yet", () => {
		expect(applyWorkspaceGit(undefined, config({ lfs: { auto: true } }))).toEqual({ lfs: { auto: true } });
	});
});
