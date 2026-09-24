import { parseSecretDraft } from "./secretDraft";

describe("parseSecretDraft", () => {
	test.each([
		["Ютрек.token", { key: "Ютрек", kind: "token", focus: "value" }],
		["GitHub.login", { key: "GitHub", kind: "login", focus: "login" }],
		["GitHub.password", { key: "GitHub", kind: "login", focus: "value" }],
		["Mail.url", { key: "Mail", kind: "token", focus: "url" }],
		["my.service.token", { key: "my.service", kind: "token", focus: "value" }],
	] as const)("parses %s", (name, expected) => {
		expect(parseSecretDraft(name)).toEqual(expected);
	});

	test("splits on the last dot, not the first", () => {
		expect(parseSecretDraft("my.service.token").key).toBe("my.service");
	});

	test("falls back to kind token / focus value for a name with no recognized field suffix", () => {
		expect(parseSecretDraft("just-a-key")).toEqual({ key: "just-a-key", kind: "token", focus: "value" });
	});
});
