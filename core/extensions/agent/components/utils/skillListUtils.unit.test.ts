import { filterSkillItems, getSkillDescription } from "./skillListUtils";

const skills = [
	{ description: "Review changes and naming", id: "review", title: "Review PR" },
	{ description: "Find the likely root cause", id: "bug", title: "Bug analysis" },
];

describe("getSkillDescription", () => {
	it("returns a single-line first paragraph", () => {
		expect(getSkillDescription("Analyze the stack trace\nand suggest a fix.\n\n## Instructions\nMore text")).toBe(
			"Analyze the stack trace and suggest a fix.",
		);
	});
});

describe("filterSkillItems", () => {
	it("matches titles and descriptions case-insensitively", () => {
		expect(filterSkillItems(skills, "ROOT").map((skill) => skill.id)).toEqual(["bug"]);
		expect(filterSkillItems(skills, "review").map((skill) => skill.id)).toEqual(["review"]);
	});
});
