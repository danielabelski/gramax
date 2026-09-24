import { otelSpanEncoder } from "./span";

describe("OtelSpanEncoder.serialize binary payloads", () => {
	test("a Buffer collapses to a size stub instead of a byte-indexed object", () => {
		const buffer = Buffer.alloc(256 * 1024, 1);

		const serialized = otelSpanEncoder.serialize(buffer);

		expect(serialized).toBe(JSON.stringify("<binary 262144 bytes>"));
	});

	test("a nested typed array collapses while its siblings survive", () => {
		const args = { path: "resources/screenshot.png", data: new Uint8Array(64 * 1024) };

		const serialized = otelSpanEncoder.serialize(args) as string;

		expect(JSON.parse(serialized)).toEqual({
			path: "resources/screenshot.png",
			data: "<binary 65536 bytes>",
		});
	});

	test("a multi-megabyte screenshot stays bounded — no byte-wise expansion", () => {
		const screenshot = { name: "image.png", content: Buffer.alloc(4 * 1024 * 1024) };

		const serialized = otelSpanEncoder.serialize(screenshot) as string;

		expect(serialized.length).toBeLessThan(4096);
		expect(serialized).toContain("<binary 4194304 bytes>");
	});

	test("an ArrayBuffer and a DataView collapse the same way", () => {
		expect(otelSpanEncoder.serialize(new ArrayBuffer(1024))).toBe(JSON.stringify("<binary 1024 bytes>"));
		expect(otelSpanEncoder.serialize(new DataView(new ArrayBuffer(512)))).toBe(
			JSON.stringify("<binary 512 bytes>"),
		);
	});
});

describe("OtelSpanEncoder.serialize size cap", () => {
	test("an oversized plain object is cut while building, not sliced after stringify", () => {
		const wide: Record<string, string> = {};
		for (let i = 0; i < 100_000; i++) wide[`key${i}`] = `value${i}`;

		const serialized = otelSpanEncoder.serialize(wide) as string;

		expect(serialized).toContain("<truncated>");
		expect(serialized).not.toMatch(/^<\d+ more>/);
	});

	test("a long array is cut while building, not sliced after stringify", () => {
		const long = Array.from({ length: 100_000 }, (_, i) => `item-${i}`);

		const serialized = otelSpanEncoder.serialize(long) as string;

		expect(serialized).toContain("<truncated>");
		expect(serialized).not.toMatch(/^<\d+ more>/);
	});

	test("small payloads still serialize in full", () => {
		const serialized = otelSpanEncoder.serialize({ path: "a/b.md", nested: { ok: true, n: 3 } }) as string;

		expect(JSON.parse(serialized)).toEqual({ path: "a/b.md", nested: { ok: true, n: 3 } });
	});

	test("circular references and promises keep their existing stubs", () => {
		const circular: Record<string, unknown> = { name: "root" };
		circular.self = circular;

		expect(JSON.parse(otelSpanEncoder.serialize(circular) as string)).toEqual({
			name: "root",
			self: "<circular>",
		});
		expect(JSON.parse(otelSpanEncoder.serialize({ p: Promise.resolve(1) }) as string)).toEqual({
			p: "<promise>",
		});
	});
});

describe("OtelSpanEncoder.serialize long strings", () => {
	test("a nested base64 payload is cut to the budget", () => {
		const dataUrl = `data:image/png;base64,${"A".repeat(3_000_000)}`;

		const serialized = otelSpanEncoder.serialize({ src: dataUrl }) as string;

		expect(serialized.length).toBeLessThan(4096);
		expect(serialized).toContain("<truncated>");
	});
});

describe("OtelSpanEncoder.serialize secret masking", () => {
	test("the reported leak — app config reached through a field — comes out masked", () => {
		const args = [
			{
				// biome-ignore lint/style/useNamingConvention: field names copied from the reported log record
				_rp: {
					// biome-ignore lint/style/useNamingConvention: field names copied from the reported log record
					_config: {
						portalAi: { enabled: true, apiUrl: "https://ai.local", token: "ai-secret-token" },
						admin: { login: "root", password: "hunter2" },
						tokens: { share: "s3cr3t", cookie: "c00kie", healthcheck: "hc" },
						mail: { user: "bot@gram.ax", password: "mail-pass" },
					},
				},
			},
		];

		const serialized = otelSpanEncoder.serialize(args) as string;

		expect(JSON.parse(serialized)).toEqual([
			{
				// biome-ignore lint/style/useNamingConvention: field names copied from the reported log record
				_rp: {
					// biome-ignore lint/style/useNamingConvention: field names copied from the reported log record
					_config: {
						portalAi: { enabled: true, apiUrl: "https://ai.local", token: "<redacted>" },
						admin: { login: "root", password: "<redacted>" },
						tokens: { share: "<redacted>", cookie: "<redacted>", healthcheck: "<redacted>" },
						mail: { user: "bot@gram.ax", password: "<redacted>" },
					},
				},
			},
		]);
		expect(serialized).not.toContain("hunter2");
		expect(serialized).not.toContain("ai-secret-token");
	});

	test("masking covers every key spelling and survives nesting and arrays", () => {
		const serialized = otelSpanEncoder.serialize({
			bugsnagApiKey: "key",
			API_KEY: "key",
			"private-key": "key",
			clientSecret: "key",
			Authorization: "Bearer abc",
			refreshTokens: ["a", "b"],
			credentials: { nested: { deeper: "pass" } },
		}) as string;

		expect(JSON.parse(serialized)).toEqual({
			bugsnagApiKey: "<redacted>",
			API_KEY: "<redacted>",
			"private-key": "<redacted>",
			clientSecret: "<redacted>",
			Authorization: "<redacted>",
			refreshTokens: ["<redacted>", "<redacted>"],
			credentials: { nested: { deeper: "<redacted>" } },
		});
	});

	test("a secret that is absent stays absent instead of turning into a fake value", () => {
		const serialized = otelSpanEncoder.serialize({ admin: { login: "root", password: null } }) as string;

		expect(JSON.parse(serialized)).toEqual({ admin: { login: "root", password: null } });
	});

	test("non-string secrets are masked too", () => {
		const serialized = otelSpanEncoder.serialize({ tokenCount: 42, hasSecret: true }) as string;

		expect(JSON.parse(serialized)).toEqual({ tokenCount: "<redacted>", hasSecret: "<redacted>" });
	});

	test("a toSpan() projection under a secret key does not smuggle the value out", () => {
		const serialized = otelSpanEncoder.serialize({
			token: { toSpan: () => ({ value: "still-secret" }) },
			password: { toSpan: () => "still-secret" },
		}) as string;

		expect(serialized).not.toContain("still-secret");
	});

	test("an object reachable from both a plain and a secret key is masked under the secret one", () => {
		const shared = { value: "s3cr3t" };

		const serialized = otelSpanEncoder.serialize({ plain: shared, tokens: shared }) as string;

		expect(JSON.parse(serialized)).toEqual({
			plain: { value: "s3cr3t" },
			tokens: { value: "<redacted>" },
		});
	});

	test("the same object twice under a plain key is not mistaken for a cycle", () => {
		const shared = { value: "ok" };

		const serialized = otelSpanEncoder.serialize({ a: shared, b: shared }) as string;

		expect(JSON.parse(serialized)).toEqual({ a: { value: "ok" }, b: { value: "ok" } });
	});

	test("ordinary payloads are untouched", () => {
		const serialized = otelSpanEncoder.serialize({ path: "a/b.md", user: "root", count: 2 }) as string;

		expect(JSON.parse(serialized)).toEqual({ path: "a/b.md", user: "root", count: 2 });
	});
});
