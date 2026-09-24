import { isAbortError } from "@core/utils/isAbortError";

describe("isAbortError", () => {
	it("recognises only an aborted request", () => {
		expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
		expect(isAbortError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(true);
		expect(isAbortError(new DOMException("nope", "TypeError"))).toBe(false);
		expect(isAbortError(new Error("boom"))).toBe(false);
		expect(isAbortError(undefined)).toBe(false);
	});
});
