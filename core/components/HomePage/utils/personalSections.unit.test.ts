/**
 * @jest-environment node
 */
import type { WorkspaceSection } from "@ext/workspace/WorkspaceConfig";
import { resolvePersonalSections } from "./personalSections";

const globalSections: Record<string, WorkspaceSection> = {
	docs: { title: "Docs", catalogs: ["guide"] },
};
const personalSections: Record<string, WorkspaceSection> = {
	personal: { title: "Personal", catalogs: ["notes"] },
};

describe("personal homepage sections", () => {
	test("uses the global layout when no personal override exists", () => {
		expect(resolvePersonalSections(globalSections, undefined)).toBe(globalSections);
	});

	test("uses the personal override when it exists", () => {
		expect(resolvePersonalSections(globalSections, personalSections)).toBe(personalSections);
	});
});
