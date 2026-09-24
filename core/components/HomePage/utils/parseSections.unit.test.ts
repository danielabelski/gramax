/** @jest-environment node */
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import { UNCATEGORIZED_ID } from "./homeLayoutTypes";
import { parseSections, seenCatalogs } from "./parseSections";

describe("parseSections", () => {
	test("stores catalogs and folders in their display order", () => {
		expect(
			parseSections([
				{
					id: "docs",
					title: "Docs",
					items: [
						{ type: "catalog", name: "guide" },
						{ type: "folder", id: "manuals", title: "Manuals", items: [] },
						{ type: "catalog", name: "api" },
					],
				},
			]),
		).toEqual([
			{
				type: "section",
				id: "docs",
				title: "Docs",
				view: WorkspaceView.section,
				items: [
					{ type: "catalog", name: "guide" },
					{ type: "section", id: "manuals", title: "Manuals", view: WorkspaceView.folder, items: [] },
					{ type: "catalog", name: "api" },
				],
			},
		]);
	});

	test("stores uncategorized catalogs and folders directly at the root", () => {
		expect(
			parseSections([
				{
					id: UNCATEGORIZED_ID,
					items: [
						{ type: "catalog", name: "loose" },
						{ type: "folder", id: "archive", title: "Archive", items: ["old"] },
					],
				},
			]),
		).toEqual([
			{ type: "catalog", name: "loose" },
			{
				type: "section",
				id: "archive",
				title: "Archive",
				view: WorkspaceView.folder,
				items: [{ type: "catalog", name: "old" }],
			},
		]);
	});

	test("preserves descendants which are not editable on the homepage", () => {
		const children = [{ type: "section" as const, id: "deep", title: "Deep", items: [] }];
		const [folder] = parseSections([
			{ id: UNCATEGORIZED_ID, items: [{ type: "folder", id: "tools", title: "Tools", items: [], children }] },
		]);
		expect(folder).toMatchObject({ items: children });
	});
});

describe("seenCatalogs", () => {
	test("collects catalogs from sections, folders, and the uncategorized block", () => {
		expect(
			seenCatalogs([
				{
					id: "docs",
					title: "Docs",
					items: [
						{ type: "catalog", name: "api" },
						{ type: "folder", id: "guides", title: "Guides", items: ["git"] },
					],
				},
				{ id: UNCATEGORIZED_ID, items: [{ type: "catalog", name: "onboarding" }] },
			]),
		).toEqual(["api", "git", "onboarding"]);
	});

	test("collects catalogs from descendants hidden from the homepage editor", () => {
		expect(
			seenCatalogs([
				{
					id: "docs",
					items: [
						{
							type: "folder",
							id: "guides",
							title: "Guides",
							items: ["visible"],
							children: [
								{
									type: "section",
									id: "deep",
									title: "Deep",
									items: [{ type: "catalog", name: "nested" }],
								},
							],
						},
					],
				},
			]),
		).toEqual(["visible", "nested"]);
	});
});
