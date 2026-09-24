import { isBreakpointAtLeast, resolveBreakpoint } from "@core-ui/ContextServices/BreakpointService";

describe("BreakpointService", () => {
	it.each([
		[0, "sm"],
		[639, "sm"],
		[640, "sm"],
		[767, "sm"],
		[768, "md"],
		[1023, "md"],
		[1024, "lg"],
		[1279, "lg"],
		[1280, "xl"],
		[1535, "xl"],
		[1536, "2xl"],
	] as const)("resolves %dpx to %s", (width, expected) => {
		expect(resolveBreakpoint(width)).toBe(expected);
	});

	it("compares breakpoints in Tailwind order", () => {
		expect(isBreakpointAtLeast("lg", "md")).toBe(true);
		expect(isBreakpointAtLeast("lg", "lg")).toBe(true);
		expect(isBreakpointAtLeast("lg", "xl")).toBe(false);
	});
});
