import { RegexSafety } from "./regexSafety";

const rejects = (pattern: string) =>
	expect(() => RegexSafety.assertNoNestedQuantifiers(pattern)).toThrow("nested quantifiers are not supported");
const accepts = (pattern: string) => expect(() => RegexSafety.assertNoNestedQuantifiers(pattern)).not.toThrow();

describe("assertNoNestedQuantifiers", () => {
	test("rejects the classic exponential shapes", () => {
		rejects("(a+)+$");
		rejects("(a*)*");
		rejects("(a+)*");
		rejects("(a*)+");
		rejects("(\\s*)*");
		rejects("([\\s\\S]+)+end");
	});

	test("rejects non-capturing and nested groups", () => {
		rejects("(?:a+)+");
		rejects("((a+))+");
		rejects("prefix(?:x|y+)*suffix");
	});

	test("rejects lazy and open-ended forms", () => {
		rejects("(a+)+?");
		rejects("(a+?)+");
		rejects("(a+){2,}");
	});

	test("rejects any bounded repetition above one", () => {
		rejects("(a+){2}");
		rejects("(a+){20}");
		rejects("(a+){1,3}");
		rejects("(.*a){20}x");
		rejects("((a+){1})+");
	});

	test("rejects a group whose inner repetition is ambiguous but bounded", () => {
		rejects("(a{1,9})+");
		rejects("(\\s{0,5})*");
		rejects("((ab){1,9})+");
		rejects("(a?b?)+$");
	});

	test("accepts a quantified group without an inner quantifier", () => {
		accepts("(abc)+");
		accepts("(foo|bar)*");
		accepts("(\\d)+");
		accepts("(?:abc)+");
		accepts("(?:foo|bar)*");
		accepts("(?<n>\\d)+");
		accepts("(?:ab){1,9}");
		accepts("(a{2})+");
		accepts("(\\d{2})+$");
	});

	test("accepts an inner quantifier without an outer one", () => {
		accepts("(a+)b");
		accepts("first[\\s\\S]*last");
		accepts("\\d{3}-\\d{2}");
		accepts("TODO|FIXME");
		accepts("^## ");
	});

	test("accepts a group that repeats at most once", () => {
		accepts("(a+)?");
		accepts("(a+){1}");
		accepts("(a+){0,1}");
	});

	test("ignores quantifier characters inside a character class", () => {
		accepts("[(+*)]+");
		accepts("[a-z*]+[0-9+]*");
	});

	test("ignores escaped parentheses and quantifiers", () => {
		accepts("\\(a+\\)+");
		accepts("a\\+\\+");
	});

	test("ignores an escaped closing bracket inside a character class", () => {
		accepts("[\\]*]+");
	});

	test("does not throw on a malformed pattern", () => {
		accepts("(a+");
		accepts("a)+");
		accepts("(a+){oops}");
	});
});
