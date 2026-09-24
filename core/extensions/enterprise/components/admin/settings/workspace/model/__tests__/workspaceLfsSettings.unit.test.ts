import { withLfsChange } from "../workspaceLfsSettings";

describe("withLfsChange", () => {
	const stated = { patterns: ["*.png"], auto: true, exclude: ["*.psd"] };

	test("editing the masks leaves the policy alone", () => {
		expect(withLfsChange(stated, { patterns: ["*.png", "*.gif"] })).toEqual({
			patterns: ["*.png", "*.gif"],
			auto: true,
			exclude: ["*.psd"],
		});
	});

	test("switching the policy off leaves the masks and the exclusions alone", () => {
		expect(withLfsChange(stated, { auto: false })).toEqual({ ...stated, auto: false });
	});

	test("editing the exclusions leaves the rest alone", () => {
		expect(withLfsChange(stated, { exclude: [] })).toEqual({ ...stated, exclude: [] });
	});

	test("a workspace that stated nothing yet gets just the change", () => {
		expect(withLfsChange(undefined, { auto: true })).toEqual({ auto: true });
	});
});
