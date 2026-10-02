import { fromRaw } from "@ext/git/core/GitCommands/errors/LibGit2Error";
import GitErrorCode from "@ext/git/core/GitCommands/errors/model/GitErrorCode";

// libgit2 raw values, as serialized by crates/git/src/error.rs:
//   class=Index => 10, code=Locked => |-14| => 14.
const INDEX_CLASS = 10;
const LOCKED_CODE = 14;

describe("LibGit2Error.fromRaw — catalog-breaking classification", () => {
	test("odb healthcheck failure (subset 3) is catalog-breaking", () => {
		// Baseline: repo.healthcheck() found bad objects => Rust subset === 3.
		const code = fromRaw(3, INDEX_CLASS, LOCKED_CODE, "missing blob");
		expect(code).toBe(GitErrorCode.HealthcheckFailed);
	});

	test("locked index without bad objects (subset 1) is catalog-breaking", () => {
		// GES-80: ".git/index.lock" present but objects healthy => Rust subset === 1.
		// Must still mark the catalog broken so the recovery modal appears.
		const code = fromRaw(
			1,
			INDEX_CLASS,
			LOCKED_CODE,
			"the index is locked; this might be due to a concurrent or crashed process",
		);
		expect(code).toBe(GitErrorCode.HealthcheckFailed);
	});

	test("merge-conflict index errors are NOT misclassified as catalog-breaking", () => {
		// Regression guard: class=Index codes 8/10 stay MergeConflictError.
		expect(fromRaw(1, 10, 8, "conflict")).toBe(GitErrorCode.MergeConflictError);
		expect(fromRaw(1, 10, 10, "conflict")).toBe(GitErrorCode.MergeConflictError);
	});
});

describe("LibGit2Error.fromRaw — disk-full classification (#806)", () => {
	test("a StorageFull lock-file error is classified as NotEnoughDiskSpace, not a broken repo", () => {
		// Exact message from the report: `add` fails writing the index lock file when the disk is full.
		const message = 'lock file other error: Os { code: 28, kind: StorageFull, message: "No space left on device" }';
		expect(fromRaw(11, 0, 0, message)).toBe(GitErrorCode.NotEnoughDiskSpace);
	});

	test("Unix strerror alone (without the Rust kind) is enough to classify", () => {
		expect(fromRaw(1, 0, 0, "No space left on device")).toBe(GitErrorCode.NotEnoughDiskSpace);
	});

	test("disk-full wins even when the class/code would otherwise mark the repo broken", () => {
		expect(fromRaw(1, INDEX_CLASS, LOCKED_CODE, "lock file: Os { kind: StorageFull }")).toBe(
			GitErrorCode.NotEnoughDiskSpace,
		);
	});
});

describe("LibGit2Error.fromRaw — unreachable git server (#gx-network)", () => {
	// Rust subset 5 = Error::Network (crates/git/src/error.rs), code = the http status
	// post.ts recorded. 999 is the synthetic status it assigns when XHR reports 0 —
	// the request never reached the server (DNS failure, offline, CORS rejection).
	test("a synthetic 999 network status is a connectivity error, not a generic http error", () => {
		const message =
			"Failed to send request to 'https://gitlab.example.com/g/r.git': domain 'gitlab.example.com' unreachable or CORS headers incorrect";
		expect(fromRaw(5, undefined, 999, message, "clone")).toBe(GitErrorCode.NetworkConntectionError);
	});

	test("real http statuses keep their existing classification", () => {
		expect(fromRaw(5, undefined, 500, "internal server error")).toBe(GitErrorCode.HttpError);
		expect(fromRaw(5, undefined, 403, "denied")).toBe(GitErrorCode.NotAuthorizedError);
		expect(fromRaw(5, undefined, 404, "no repo")).toBe(GitErrorCode.RemoteRepositoryNotFoundError);
	});
});

describe("LibGit2Error.fromRaw — invalid path on checkout (NM-24)", () => {
	const CHECKOUT_CLASS = 20;

	test("a filename invalid on Windows (e.g. a double quote) is classified as InvalidPathError", () => {
		const message = "cannot checkout to invalid path 'docs/Шаблон \"Информация для дубля\".rtf'";
		expect(fromRaw(1, CHECKOUT_CLASS, 1, message)).toBe(GitErrorCode.InvalidPathError);
	});

	test("other checkout-class errors keep their existing classification", () => {
		expect(fromRaw(1, CHECKOUT_CLASS, 11, "conflict")).toBe(GitErrorCode.CheckoutConflictError);
	});
});
