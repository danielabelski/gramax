import {
	customLfsExclude,
	DEFAULT_LFS_EXCLUDE,
	pickLfsPatternFor,
	resolveAutoLfs,
	resolveLfsExclude,
} from "@core/GitLfs/logic/autoLfsAttachments";
import ResourceExtensions from "@core/Resource/ResourceExtensions";

const pick = (over: Partial<Parameters<typeof pickLfsPatternFor>[0]> = {}) =>
	pickLfsPatternFor({ auto: true, exclude: [], patterns: [], relPath: "docs/img.psd", ...over });

describe("resolveLfsExclude", () => {
	test("a list in the request wins over what the catalog stored", () => {
		expect(resolveLfsExclude(["*.gif"], { auto: true, exclude: ["*.psd"] })).toContain("*.gif");
		expect(resolveLfsExclude(["*.gif"], { auto: true, exclude: ["*.psd"] })).not.toContain("*.psd");
	});

	test("no request falls back to what the catalog has stored", () => {
		expect(resolveLfsExclude(undefined, { auto: true, exclude: ["*.psd"] })).toContain("*.psd");
	});

	test("the defaults join every answer, whatever the request or the catalog says", () => {
		for (const answer of [
			resolveLfsExclude(["*.gif"], { auto: true, exclude: ["*.psd"] }),
			resolveLfsExclude([], { auto: true, exclude: ["*.psd"] }),
			resolveLfsExclude(undefined, { auto: true, exclude: [] }),
			resolveLfsExclude(undefined, undefined),
			resolveLfsExclude(undefined, { auto: false }),
		]) {
			expect(answer).toEqual(expect.arrayContaining(DEFAULT_LFS_EXCLUDE));
		}
	});

	test("a default the catalog also stores appears once", () => {
		const stored = DEFAULT_LFS_EXCLUDE[0];
		const answer = resolveLfsExclude(undefined, { auto: true, exclude: [stored] });
		expect(answer.filter((pattern) => pattern === stored)).toHaveLength(1);
	});
});

describe("resolveLfsExclude with a workspace policy", () => {
	test("the workspace list joins the catalog's rather than replacing it", () => {
		const answer = resolveLfsExclude(undefined, { auto: true, exclude: ["*.gif"] }, { exclude: ["*.psd"] });

		expect(answer).toContain("*.psd");
		expect(answer).toContain("*.gif");
		expect(answer).toEqual(expect.arrayContaining(DEFAULT_LFS_EXCLUDE));
	});

	test("a workspace pattern the catalog repeats appears once", () => {
		const answer = resolveLfsExclude(["*.psd"], undefined, { exclude: ["*.psd"] });

		expect(answer.filter((pattern) => pattern === "*.psd")).toHaveLength(1);
	});

	test("a policy that excludes nothing changes nothing", () => {
		expect(resolveLfsExclude(["*.gif"], undefined, {})).toEqual(resolveLfsExclude(["*.gif"], undefined));
	});
});

describe("resolveAutoLfs", () => {
	test("a workspace that turned the auto-add on decides", () => {
		expect(resolveAutoLfs({ auto: true }, { auto: false })).toBe(true);
		expect(resolveAutoLfs({ auto: true }, undefined)).toBe(true);
	});

	test("a workspace that imposed nothing leaves it to the catalog", () => {
		expect(resolveAutoLfs({}, { auto: true })).toBe(true);
		expect(resolveAutoLfs(undefined, { auto: true })).toBe(true);
		expect(resolveAutoLfs({ exclude: ["*.psd"] }, { auto: false })).toBe(false);
	});

	test("a catalog that was never asked stays off", () => {
		expect(resolveAutoLfs(undefined, undefined)).toBe(false);
		expect(resolveAutoLfs({}, {})).toBe(false);
	});
});

describe("customLfsExclude", () => {
	test("keeps what a catalog added on top", () => {
		expect(customLfsExclude(["*.psd", "*.gif"])).toEqual(["*.psd", "*.gif"]);
	});

	test("drops the defaults, so a list written before they were implicit reads back as extras alone", () => {
		expect(customLfsExclude([...DEFAULT_LFS_EXCLUDE, "*.psd"])).toEqual(["*.psd"]);
	});

	test("an absent list is no extras at all", () => {
		expect(customLfsExclude(undefined)).toEqual([]);
	});
});

describe("pickLfsPatternFor", () => {
	test("returns the extension mask when nothing covers the file", () => {
		expect(pick()).toBe("*.psd");
	});

	test("returns null when the switch is off", () => {
		expect(pick({ auto: false })).toBeNull();
	});

	test("returns null when an exclusion matches", () => {
		expect(pick({ relPath: "docs/diagram.svg", exclude: ["*.svg"] })).toBeNull();
	});

	test("returns null when an existing mask already covers the file", () => {
		expect(pick({ relPath: "docs/img.png", patterns: ["*.png"] })).toBeNull();
	});

	test("returns null when a directory-scoped mask covers the file", () => {
		expect(pick({ relPath: "img/a.png", patterns: ["img/*.png"] })).toBeNull();
	});

	test("adds a mask when the existing directory mask does not reach the file", () => {
		expect(pick({ relPath: "other/a.png", patterns: ["img/*.png"] })).toBe("*.png");
	});

	test("returns null for a file without an extension", () => {
		expect(pick({ relPath: "docs/Makefile" })).toBeNull();
		expect(pick({ relPath: "docs/" })).toBeNull();
	});

	test("a dotfile picks up no mask: it is a config file, not an attachment", () => {
		expect(pick({ relPath: ".gitignore" })).toBeNull();
		expect(pick({ relPath: "docs/.gitignore" })).toBeNull();
	});

	test("uses the last extension of a multi-dot name", () => {
		expect(pick({ relPath: "docs/archive.tar.gz" })).toBe("*.gz");
	});

	test("keeps the extension case, so an uppercase file is not covered by the lowercase mask", () => {
		expect(pick({ relPath: "docs/IMG.PNG", patterns: ["*.png"] })).toBe("*.PNG");
	});

	test("ordinary attachment extensions pass, digits and all", () => {
		for (const extension of ["png", "jpeg", "webm", "docx", "7z", "gz", "mp4", "PNG"]) {
			expect(pick({ relPath: `docs/file.${extension}` })).toBe(`*.${extension}`);
		}
	});

	test("the default exclusion list is the diagram sources plus text types that gain nothing from LFS", () => {
		expect(DEFAULT_LFS_EXCLUDE).toEqual([
			...ResourceExtensions.diagrams.map((extension) => `*.${extension}`),
			"*.html",
		]);
		expect(DEFAULT_LFS_EXCLUDE).toEqual(["*.svg", "*.puml", "*.yaml", "*.mermaid", "*.html"]);
	});

	test("a service file mints no mask, even with the exclusions cleared", () => {
		for (const relPath of [".doc-root.yaml", "docs/_index.md", "docs/nested/.docroot.yml"]) {
			expect(pick({ relPath, exclude: [] })).toBeNull();
		}
	});

	test("an article extension mints no mask, even with the exclusions cleared", () => {
		for (const relPath of ["article.md", "docs/nested/article.md", "docs/README.MD"]) {
			expect(pick({ relPath, exclude: [] })).toBeNull();
		}
	});

	test("a diagram source picks up no mask by default", () => {
		for (const relPath of ["docs/a.svg", "docs/a.puml", "docs/a.yaml", "docs/a.mermaid"]) {
			expect(pick({ relPath, exclude: DEFAULT_LFS_EXCLUDE })).toBeNull();
		}
	});
});
