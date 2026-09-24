import type { AppConfig } from "@app/config/AppConfig";
import resolveModule from "@app/resolveModule/backend";
import CookieMock from "@ext/wordExport/tests/CookieMock";
import { AgentSecretStore } from "./agentSecretStore";

jest.mock("@app/resolveModule/backend", () => ({
	// biome-ignore lint/style/useNamingConvention: jest ESM mock flag
	__esModule: true,
	default: jest.fn(),
}));

const config = { tokens: { cookie: "test-secret" } } as AppConfig;

describe("AgentSecretStore", () => {
	let storage: CookieMock;
	let store: AgentSecretStore;

	beforeEach(() => {
		storage = new CookieMock("test-secret");
		(resolveModule as unknown as jest.Mock).mockImplementation(
			() =>
				function SecretStorageImpl() {
					return storage;
				},
		);
		store = new AgentSecretStore(config);
	});

	test("loads and lists secrets", async () => {
		await new AgentSecretStore(config).set("YOUTRACK", {
			type: "token",
			token: "perm:abc",
			url: "youtrack.example",
		});
		await store.load();
		expect(store.list()).toEqual({ YOUTRACK: { type: "token" } });
		expect(store.list(true)).toEqual({ YOUTRACK: { type: "token", token: "perm:abc", url: "youtrack.example" } });
		expect(store.refs()).toEqual({ "YOUTRACK.token": undefined, "YOUTRACK.url": undefined });
		expect(store.refs(true)).toEqual({ "YOUTRACK.token": "perm:abc", "YOUTRACK.url": "youtrack.example" });
	});

	test("set persists encrypted snapshot", async () => {
		await store.set("YOUTRACK", { type: "token", token: "perm:abc" });
		expect(JSON.stringify((storage as unknown as { cookies: Record<string, string> }).cookies)).not.toContain(
			"perm:abc",
		);
	});

	test("delete removes persisted key", async () => {
		await store.set("A", { type: "token", token: "1" });
		await store.set("B", { type: "token", token: "2" });
		await store.delete("A");

		const reloaded = new AgentSecretStore(config);
		await reloaded.load();
		expect(reloaded.list(true)).toEqual({ B: { type: "token", token: "2" } });
	});

	test("update replaces the old key with the new one in a single save", async () => {
		await store.set("A", { type: "token", token: "1" });
		await store.update("A", "B", { type: "token", token: "2" });

		const reloaded = new AgentSecretStore(config);
		await reloaded.load();
		expect(reloaded.list(true)).toEqual({ B: { type: "token", token: "2" } });
	});

	test("update with an unchanged key just updates the value", async () => {
		await store.set("A", { type: "token", token: "1" });
		await store.update("A", "A", { type: "token", token: "2" });

		expect(store.list(true)).toEqual({ A: { type: "token", token: "2" } });
	});

	test("update keeps the renamed key's position instead of moving it to the end", async () => {
		await store.set("A", { type: "token", token: "1" });
		await store.set("B", { type: "token", token: "2" });
		await store.set("C", { type: "token", token: "3" });

		await store.update("B", "RENAMED", { type: "token", token: "2" });

		expect(Object.keys(store.list(true))).toEqual(["A", "RENAMED", "C"]);

		const reloaded = new AgentSecretStore(config);
		await reloaded.load();
		expect(Object.keys(reloaded.list(true))).toEqual(["A", "RENAMED", "C"]);
	});

	test("resolve substitutes login, password, token and url fields", async () => {
		await store.set("EMAIL", { type: "token", token: "u@example.com" });
		await store.set("YANDEX", { type: "login", login: "user", password: "pass", token: "tok", url: "yandex.ru" });

		const input = JSON.stringify({
			url: `https://caldav.yandex.ru/calendars/\${EMAIL.token}/events-default/`,
			auth: `\${YANDEX.login}:\${YANDEX.password}`,
			bearer: `\${YANDEX.token}`,
			imap: `imaps://imap.\${YANDEX.url}/INBOX`,
		});

		expect(JSON.parse(store.resolve(input).text)).toEqual({
			url: "https://caldav.yandex.ru/calendars/u@example.com/events-default/",
			auth: "user:pass",
			bearer: "tok",
			imap: "imaps://imap.yandex.ru/INBOX",
		});
	});

	test("resolve escapes secret values for json", async () => {
		await store.set("TOKEN", { type: "token", token: 'a"b' });
		expect(JSON.parse(store.resolve(`{"token":"\${TOKEN.token}"}`).text)).toEqual({ token: 'a"b' });
	});

	test("resolve returns missing secret names", async () => {
		await store.set("EMAIL", { type: "token", token: "u@example.com" });
		expect(store.resolve(`{"url":"\${EMAIL.token}/\${TOKEN.token}","auth":"\${BASIC.login}"}`).missing).toEqual([
			"TOKEN.token",
			"BASIC.login",
		]);
	});

	test("resolve treats escaped secret var as literal", async () => {
		await store.set("TOKEN", { type: "token", token: "secret" });
		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${} secret placeholders
		const result = store.resolve('{"url":"$${TOKEN.token}","auth":"${TOKEN.token}"}');
		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${} secret placeholders
		expect(JSON.parse(result.text)).toEqual({ url: "${TOKEN.token}", auth: "secret" });
		expect(result.missing).toEqual([]);
	});

	test("a key with a space resolves inside braces", async () => {
		await store.set("My Password", { type: "token", token: "hunter2" });
		expect(JSON.parse(store.resolve(`{"auth":"\${My Password.token}"}`).text)).toEqual({ auth: "hunter2" });
	});

	test("unresolve restores placeholders", async () => {
		await store.set("EMAIL", { type: "token", token: "u@example.com" });
		expect(store.unresolve('{"email":"u@example.com"}')).toBe(`{"email":"\${EMAIL.token}"}`);
	});

	test("unresolve matches json-escaped secret values", async () => {
		await store.set("TOKEN", { type: "token", token: 'a"b\\c\nd' });
		const escaped = JSON.stringify('a"b\\c\nd').slice(1, -1);
		expect(store.unresolve(`{"token":"${escaped}"}`)).toBe(`{"token":"\${TOKEN.token}"}`);
	});

	test("unresolve skips empty secret values", async () => {
		await store.set("EMPTY", { type: "token", token: "" });
		expect(store.unresolve('{"ok":true}')).toBe('{"ok":true}');
	});

	test("unresolve does not replace domain with url placeholder", async () => {
		await store.set("YANDEX", { type: "token", token: "tok", url: "yandex.ru" });
		expect(store.unresolve("https://imap.yandex.ru/INBOX")).toBe("https://imap.yandex.ru/INBOX");
	});
});
