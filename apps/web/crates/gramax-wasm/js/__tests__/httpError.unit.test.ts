import { buildHttpError, NETWORK_ERROR_STATUS, NETWORK_TRANSPORT_ERROR, toTransportError } from "../httpError";

const encode = (s: string) => new TextEncoder().encode(s);

describe("buildHttpError — what XHR actually hands us", () => {
	test("a successful status produces no error", () => {
		expect(buildHttpError(200, encode("pack data").buffer)).toBeNull();
		expect(buildHttpError(204, null)).toBeNull();
	});

	test("a network failure (status 0, response null) becomes a synthetic network error", () => {
		// XHR with responseType "arraybuffer" sets `response` to null when the request never
		// reached the server — DNS failure, offline, or a CORS rejection.
		const err = buildHttpError(0, null, "https://gitlab.example.com/group/repo.git");

		expect(err).not.toBeNull();
		expect(err.status).toBe(NETWORK_ERROR_STATUS);
		expect(err.body).toContain("gitlab.example.com");
	});

	test("a network failure without a url still reports a readable message", () => {
		const err = buildHttpError(0, undefined);

		expect(err.status).toBe(NETWORK_ERROR_STATUS);
		expect(err.body.length).toBeGreaterThan(0);
	});

	test("status 0 with a body keeps the body but still gets a non-zero status", () => {
		// `-0` is indistinguishable from success for the C caller, so the status must never stay 0.
		const err = buildHttpError(0, encode("boom").buffer);

		expect(err.status).toBe(NETWORK_ERROR_STATUS);
		expect(err.body).toBe("boom");
	});

	test("an http error body arrives as an ArrayBuffer and is decoded as-is", () => {
		const err = buildHttpError(403, encode('{"message":"denied"}').buffer);

		expect(err.status).toBe(403);
		expect(err.body).toBe('{"message":"denied"}');
	});

	test("an oversized ArrayBuffer body is truncated to 4096 bytes", () => {
		// ArrayBuffer has no `.length` — the old `body.length > 4096` check never fired,
		// so whole responses were copied into wasm memory.
		const err = buildHttpError(500, encode("x".repeat(10000)).buffer);

		expect(err.body).toHaveLength(4096);
	});

	test("a Uint8Array body works too", () => {
		const err = buildHttpError(404, encode("not found"));

		expect(err.status).toBe(404);
		expect(err.body).toBe("not found");
	});
});

describe("toTransportError — the code handed back to wasm", () => {
	test("a real http status becomes its negative, which the LFS layer maps to a named error", () => {
		expect(toTransportError(404)).toBe(-404);
		expect(toTransportError(403)).toBe(-403);
	});

	test("a network failure never collides with -999, libgit2's 'request aborted'", () => {
		expect(toTransportError(NETWORK_ERROR_STATUS)).toBe(NETWORK_TRANSPORT_ERROR);
		expect(toTransportError(NETWORK_ERROR_STATUS)).not.toBe(-999);
	});

	test("a missing status still yields an error code, never 0", () => {
		expect(toTransportError(0)).toBe(NETWORK_TRANSPORT_ERROR);
	});
});
