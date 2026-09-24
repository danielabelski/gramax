/** @jest-environment node */
import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";
import { mergeEnterpriseLayout } from "./saveSections";

test("enterprise layout save retains catalogs hidden from the current user", () => {
	const config = {
		name: "Workspace",
		layout: {
			items: [
				{ type: "catalog" as const, name: "visible" },
				{ type: "catalog" as const, name: "hidden" },
			],
		},
	} satisfies WorkspaceConfig;
	const sections = [{ id: "__uncategorized__", items: [{ type: "catalog" as const, name: "visible" }] }];

	expect(mergeEnterpriseLayout(config, sections)).toEqual([
		{ type: "catalog", name: "visible" },
		{ type: "catalog", name: "hidden" },
	]);
});
