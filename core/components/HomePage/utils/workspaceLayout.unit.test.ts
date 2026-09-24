/**
 * @jest-environment node
 */
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import { resolveWorkspaceLayout, withWorkspaceLayoutItems } from "./workspaceLayout";

describe("resolveWorkspaceLayout", () => {
	test("prefers the canonical layout over legacy fields", () => {
		const layout = { items: [{ type: "catalog" as const, name: "canonical" }] };
		expect(
			resolveWorkspaceLayout({
				name: "workspace",
				layout,
				sections: { legacy: { title: "Legacy", catalogs: ["legacy"] } },
			}),
		).toBe(layout);
	});

	test("converts legacy root folders and sections to an ordered tree", () => {
		expect(
			resolveWorkspaceLayout({
				name: "workspace",
				sections: {
					folder: { title: "Folder", catalogs: ["nested"] },
					docs: { title: "Docs", view: WorkspaceView.section, catalogs: ["guide", "api"] },
				},
			}),
		).toEqual({
			items: [
				{
					type: "section",
					id: "docs",
					title: "Docs",
					view: WorkspaceView.section,
					items: [
						{ type: "catalog", name: "guide" },
						{ type: "catalog", name: "api" },
					],
				},
				{
					type: "section",
					id: "folder",
					title: "Folder",
					items: [{ type: "catalog", name: "nested" }],
				},
			],
		});
	});

	test("converts a complete personal legacy override", () => {
		const layout = resolveWorkspaceLayout({
			name: "workspace",
			sections: { docs: { title: "Docs", catalogs: ["global"] } },
			personalSections: { docs: { title: "Docs", catalogs: ["personal"] } },
		});

		expect(layout.personal?.items[0]).toMatchObject({
			type: "section",
			items: [{ type: "catalog", name: "personal" }],
		});
	});

	test("preserves nested legacy sections and their metadata", () => {
		expect(
			resolveWorkspaceLayout({
				name: "workspace",
				sections: {
					products: {
						title: "Products",
						icon: "box",
						description: "Product documentation",
						sections: {
							platform: {
								title: "Platform",
								view: WorkspaceView.folder,
								catalogs: ["api", "sdk"],
							},
						},
					},
				},
			}),
		).toEqual({
			items: [
				{
					type: "section",
					id: "products",
					title: "Products",
					icon: "box",
					description: "Product documentation",
					items: [
						{
							type: "section",
							id: "platform",
							title: "Platform",
							view: WorkspaceView.folder,
							items: [
								{ type: "catalog", name: "api" },
								{ type: "catalog", name: "sdk" },
							],
						},
					],
				},
			],
		});
	});
});

describe("withWorkspaceLayoutItems", () => {
	test("migrates legacy fields on a global save and preserves personal items", () => {
		const next = withWorkspaceLayoutItems(
			{
				name: "workspace",
				sections: { old: { title: "Old", catalogs: ["old"] } },
				personalSections: { mine: { title: "Mine", catalogs: ["mine"] } },
			},
			[{ type: "catalog", name: "new" }],
			"global",
		);

		expect(next.layout?.items).toEqual([{ type: "catalog", name: "new" }]);
		expect(next.layout?.personal?.items).toEqual([
			{ type: "section", id: "mine", title: "Mine", items: [{ type: "catalog", name: "mine" }] },
		]);
		expect(next).not.toHaveProperty("sections");
		expect(next).not.toHaveProperty("personalSections");
	});

	test("a personal save preserves global items", () => {
		const global = [{ type: "catalog" as const, name: "global" }];
		const next = withWorkspaceLayoutItems(
			{ name: "workspace", layout: { items: global } },
			[{ type: "catalog", name: "personal" }],
			"personal",
		);
		expect(next.layout).toEqual({
			items: global,
			personal: { items: [{ type: "catalog", name: "personal" }] },
		});
	});

	test("a personal save migrates both legacy views to the canonical layout", () => {
		const next = withWorkspaceLayoutItems(
			{
				name: "workspace",
				sections: { shared: { title: "Shared", catalogs: ["shared"] } },
				personalSections: { old: { title: "Old personal", catalogs: ["old"] } },
			},
			[{ type: "catalog", name: "new-personal" }],
			"personal",
		);

		expect(next.layout).toEqual({
			items: [{ type: "section", id: "shared", title: "Shared", items: [{ type: "catalog", name: "shared" }] }],
			personal: { items: [{ type: "catalog", name: "new-personal" }] },
		});
		expect(next).not.toHaveProperty("sections");
		expect(next).not.toHaveProperty("personalSections");
	});
});
