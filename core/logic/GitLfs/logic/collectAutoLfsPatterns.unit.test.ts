import collectAutoLfsPatterns from "@core/GitLfs/logic/collectAutoLfsPatterns";

describe("collectAutoLfsPatterns", () => {
	test("one mask per uncovered extension, sorted and deduplicated", () => {
		const patterns = collectAutoLfsPatterns({
			exclude: [],
			patterns: [],
			relPaths: ["a/one.png", "b/two.png", "c/three.psd"],
		});

		expect(patterns).toEqual(["*.png", "*.psd"]);
	});

	test("extensions already covered are skipped", () => {
		const patterns = collectAutoLfsPatterns({
			exclude: [],
			patterns: ["*.png"],
			relPaths: ["a/one.png", "c/three.psd"],
		});

		expect(patterns).toEqual(["*.psd"]);
	});

	test("excluded extensions are skipped", () => {
		const patterns = collectAutoLfsPatterns({
			exclude: ["*.svg"],
			patterns: [],
			relPaths: ["a/logo.svg", "c/three.psd"],
		});

		expect(patterns).toEqual(["*.psd"]);
	});

	test("files without an extension are skipped", () => {
		const patterns = collectAutoLfsPatterns({ exclude: [], patterns: [], relPaths: ["docs/Makefile"] });

		expect(patterns).toEqual([]);
	});

	test("case differences produce distinct masks", () => {
		const patterns = collectAutoLfsPatterns({ exclude: [], patterns: [], relPaths: ["a.PNG", "b.png"] });

		expect(patterns).toEqual(["*.PNG", "*.png"]);
	});

	test("no resources means no masks", () => {
		expect(collectAutoLfsPatterns({ exclude: [], patterns: [], relPaths: [] })).toEqual([]);
	});
});
