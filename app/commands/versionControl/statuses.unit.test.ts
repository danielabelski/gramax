import Path from "@core/FileProvider/Path/Path";
import { GitVersion } from "@ext/git/core/model/GitVersion";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import status from "./statuses";

// Git's well-known empty tree, spelled out here on purpose: the command has to keep sending
// exactly this oid, not whatever constant it happens to hold.
const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

const setup = (parent: GitVersion, files: { path: Path; status: FileStatus }[] = []) => {
	const diff = jest.fn().mockResolvedValue({ files });
	const catalog = {
		basePath: new Path("my-catalog"),
		repo: { gvc: { getParentCommitHash: jest.fn().mockResolvedValue(parent), diff } },
	};
	const workspace = { getContextlessCatalog: jest.fn().mockResolvedValue(catalog) };
	Reflect.set(status, "_app", { wm: { current: () => workspace } });
	return diff;
};

describe("versionControl/statuses command", () => {
	const ctx = {} as never;

	it("diffs a root commit against the empty tree, so its files read as added", async () => {
		// `get_parent` returns null for a root commit, GitCommands wraps it in GitVersion(null) and
		// `.toString()` is null. Sending `old: null` into the diff rustCall made the Rust serde
		// reject it ("invalid type: null, expected a string") and crashed the command
		// (Bugsnag 6a1ef3bb, impact 44.6). The empty tree is the parent a root commit lacks.
		const diff = setup(new GitVersion(null as unknown as string), [
			{ path: new Path("docs/readme.md"), status: FileStatus.new },
		]);

		const result = await status.do({ ctx, catalogName: "my-catalog", commitOid: "rootcommit" });

		expect(diff).toHaveBeenCalledWith({
			compare: { type: "tree", new: "rootcommit", old: EMPTY_TREE_OID },
			renames: true,
			// The empty tree has no merge base with the commit — asking for one would throw.
			useMergeBase: false,
		});
		expect(result).toEqual([{ path: "my-catalog/docs/readme.md", status: FileStatus.new }]);
	});

	it("diffs a commit with a parent against that parent", async () => {
		const diff = setup(new GitVersion("parentcommit"), [
			{ path: new Path("docs/readme.md"), status: FileStatus.modified },
		]);

		const result = await status.do({ ctx, catalogName: "my-catalog", commitOid: "childcommit" });

		expect(diff).toHaveBeenCalledWith({
			compare: { type: "tree", new: "childcommit", old: "parentcommit" },
			renames: true,
			useMergeBase: true,
		});
		expect(result).toEqual([{ path: "my-catalog/docs/readme.md", status: FileStatus.modified }]);
	});
});
