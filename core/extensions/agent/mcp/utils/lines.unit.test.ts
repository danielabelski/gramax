import { agentConfig } from "../../core/agentConfig";
import { LineMatcher, LineRange } from "./lines";

const find = (content: string, query: string, regex: boolean, maxMatches = 10) =>
	LineMatcher.findAll(content, LineMatcher.build(query, regex), maxMatches);

describe("buildContentMatcher", () => {
	test("throws on an invalid regular expression", () => {
		expect(() => LineMatcher.build("([unclosed", true)).toThrow();
	});

	test("rejects a pattern that can backtrack exponentially", () => {
		expect(() => LineMatcher.build("(a+)+$", true)).toThrow("nested quantifiers are not supported");
	});

	test("keeps the documented patterns working", () => {
		for (const pattern of ["\\d{3}-\\d{2}", "TODO|FIXME", "^## ", "first[\\s\\S]*last"]) {
			expect(() => LineMatcher.build(pattern, true)).not.toThrow();
		}
	});

	test("rejects a query longer than the allowed length", () => {
		const long = "a".repeat(agentConfig.searchQueryMaxChars + 1);
		expect(() => LineMatcher.build(long, true)).toThrow("must not be longer than");
	});

	test("treats regex metacharacters literally when regex is off", () => {
		expect(find("a.c\nabc", "a.c", false)).toEqual([{ line: 1, text: "a.c" }]);
	});
});

describe("LineMatcher.findAll", () => {
	test("returns an empty list when nothing matches", () => {
		expect(find("one\ntwo", "three", false)).toEqual([]);
	});

	test("numbers lines from 1", () => {
		expect(find("alpha\nbeta\ngamma", "gamma", false)).toEqual([{ line: 3, text: "gamma" }]);
	});

	test("matches the first line", () => {
		expect(find("alpha\nbeta", "alpha", false)).toEqual([{ line: 1, text: "alpha" }]);
	});

	test("matches the last line without a trailing newline", () => {
		expect(find("alpha\nbeta\ngamma", "gamma", false)).toEqual([{ line: 3, text: "gamma" }]);
	});

	test("ignores case", () => {
		expect(find("Alpha Beta", "alpha", false)).toEqual([{ line: 1, text: "Alpha Beta" }]);
	});

	test("matches by regular expression", () => {
		const content = "id: 123-45\nname: test\nid: 678-90";
		expect(find(content, "\\d{3}-\\d{2}", true)).toEqual([
			{ line: 1, text: "id: 123-45" },
			{ line: 3, text: "id: 678-90" },
		]);
	});

	test("supports alternation", () => {
		expect(find("done\nTODO later\nFIXME now", "TODO|FIXME", true).map((m) => m.line)).toEqual([2, 3]);
	});

	test("keeps ^ and $ as line boundaries", () => {
		expect(find("## Heading\ntext ## not a heading", "^## ", true).map((m) => m.line)).toEqual([1]);
		expect(find("alpha\nbeta", "alpha$", true).map((m) => m.line)).toEqual([1]);
	});

	test("does not let the dot cross a line break", () => {
		expect(find("alpha\nbeta", "alpha.beta", true)).toEqual([]);
	});

	test("matches a multiline pattern written with an explicit newline", () => {
		const content = "intro\nalpha\nbeta\noutro";
		expect(find(content, "alpha\\nbeta", true)).toEqual([{ line: 2, text: "alpha", endLine: 3, endText: "beta" }]);
	});

	test("matches a multiline pattern written with [\\s\\S]", () => {
		const content = "start\nfirst\nmiddle\nlast\nend";
		expect(find(content, "first[\\s\\S]*last", true)).toEqual([
			{ line: 2, text: "first", endLine: 4, endText: "last" },
		]);
	});

	test("reports the end line of a combined frontmatter-to-body match", () => {
		const content = ["---", "assignee:", "- PP", "---", "# Title", "", "Добавить кнопку «Play»"].join("\n");

		expect(find(content, "- PP[\\s\\S]*кнопк", true)).toEqual([
			{ line: 3, text: "- PP", endLine: 7, endText: "Добавить кнопку «Play»" },
		]);
	});

	test("omits end fields for a single-line match", () => {
		const [match] = find("alpha beta", "alpha", false);
		expect(match).toEqual({ line: 1, text: "alpha beta" });
		expect("endLine" in match).toBe(false);
	});

	test("collapses several matches on one line into a single entry", () => {
		expect(find("TODO and TODO again\nclean", "TODO", false)).toEqual([{ line: 1, text: "TODO and TODO again" }]);
	});

	test("does not loop forever on a zero-length pattern", () => {
		expect(find("one\ntwo\nthree", "^", true).map((m) => m.line)).toEqual([1, 2, 3]);
	});

	test("stops at maxMatches", () => {
		expect(find("x\nx\nx\nx", "x", false, 2).map((m) => m.line)).toEqual([1, 2]);
	});

	test("returns nothing when maxMatches is below one", () => {
		expect(find("x", "x", false, 0)).toEqual([]);
	});

	test("trims surrounding whitespace of the matched line", () => {
		expect(find("    indented match    ", "match", false)).toEqual([{ line: 1, text: "indented match" }]);
	});

	test("truncates a long line around the match", () => {
		const { searchMatchLineMaxChars } = agentConfig;
		const line = `${"a".repeat(searchMatchLineMaxChars * 2)}needle${"b".repeat(searchMatchLineMaxChars * 2)}`;

		const [match] = find(line, "needle", false);
		expect(match.text).toContain("needle");
		expect(match.text.startsWith("…")).toBe(true);
		expect(match.text.endsWith("…")).toBe(true);
		expect(match.text.length).toBeLessThanOrEqual(searchMatchLineMaxChars + 2);
	});

	test("keeps a line that fits untouched", () => {
		const line = "short enough line with needle inside";
		expect(find(line, "needle", false)).toEqual([{ line: 1, text: line }]);
	});
});

const document = ["one", "two", "three", "four", "five"].join("\n");

describe("hasLineRange", () => {
	test("is false without fromLine", () => {
		expect(LineRange.has({})).toBe(false);
	});

	test("is true with fromLine", () => {
		expect(LineRange.has({ fromLine: 2 })).toBe(true);
	});

	test("treats an empty fromLine as no range", () => {
		expect(LineRange.has({ fromLine: "" as never })).toBe(false);
	});
});

describe("assertValidLineRange", () => {
	test("accepts an empty range", () => {
		expect(() => LineRange.assertValid({})).not.toThrow();
	});

	test("accepts fromLine alone", () => {
		expect(() => LineRange.assertValid({ fromLine: 3 })).not.toThrow();
	});

	test("accepts fromLine together with toLine", () => {
		expect(() => LineRange.assertValid({ fromLine: 2, toLine: 4 })).not.toThrow();
	});

	test("rejects toLine without fromLine", () => {
		expect(() => LineRange.assertValid({ toLine: 4 })).toThrow("toLine is set without fromLine");
	});

	test("rejects toLine less than fromLine", () => {
		expect(() => LineRange.assertValid({ fromLine: 4, toLine: 2 })).toThrow("must not be less than fromLine");
	});

	test("rejects zero and negative line numbers", () => {
		expect(() => LineRange.assertValid({ fromLine: 0 })).toThrow("fromLine must be an integer starting from 1");
		expect(() => LineRange.assertValid({ fromLine: -1 })).toThrow("fromLine must be an integer starting from 1");
	});

	test("rejects fractional line numbers", () => {
		expect(() => LineRange.assertValid({ fromLine: 1.5 })).toThrow("fromLine must be an integer starting from 1");
	});

	test("rejects a range passed together with headingId", () => {
		expect(() => LineRange.assertValid({ fromLine: 2 }, "section-chunk~1")).toThrow("mutually exclusive");
	});

	test("accepts headingId without a range", () => {
		expect(() => LineRange.assertValid({}, "section-chunk~1")).not.toThrow();
	});
});

describe("applyLineRange", () => {
	test("returns the whole document without a range", () => {
		expect(LineRange.apply(document, {})).toEqual({ content: document, fromLine: 1, toLine: 5, totalLines: 5 });
	});

	test("reads from a line to the end", () => {
		expect(LineRange.apply(document, { fromLine: 4 })).toEqual({
			content: "four\nfive",
			fromLine: 4,
			toLine: 5,
			totalLines: 5,
		});
	});

	test("reads an inclusive range", () => {
		expect(LineRange.apply(document, { fromLine: 2, toLine: 3 })).toEqual({
			content: "two\nthree",
			fromLine: 2,
			toLine: 3,
			totalLines: 5,
		});
	});

	test("reads a single line", () => {
		expect(LineRange.apply(document, { fromLine: 3, toLine: 3 }).content).toBe("three");
	});

	test("clamps toLine past the end of the document", () => {
		expect(LineRange.apply(document, { fromLine: 5, toLine: 99 })).toEqual({
			content: "five",
			fromLine: 5,
			toLine: 5,
			totalLines: 5,
		});
	});

	test("rejects fromLine past the end of the document", () => {
		expect(() => LineRange.apply(document, { fromLine: 6 })).toThrow("past the end of the document (5)");
	});

	test("accepts line numbers sent as strings", () => {
		expect(LineRange.apply(document, { fromLine: "2" as never, toLine: "3" as never }).content).toBe("two\nthree");
	});
});
