/**
 * @jest-environment node
 */
import { EnterpriseWorkspace } from "./EnterpriseWorkspace";

jest.mock("@core/Hash/Hasher", () => ({
	XxHash: {
		hasher: () => ({
			hash() {
				return this;
			},
			finalize: () => "hash",
		}),
	},
}));

describe("EnterpriseWorkspace homepage sections sync", () => {
	test("updates shared layout without replacing the local personal override", async () => {
		const personalSections = { personal: { title: "Personal", catalogs: ["notes"] } };
		const values: Record<string, unknown> = {
			name: "Workspace",
			sections: { old: { title: "Old" } },
			personalSections,
			enterprise: { gesUrl: "https://ges.example", lastUpdateDate: 0 },
		};
		const config = {
			inner: () => values,
			get: (key: string) => values[key],
			set: (key: string, value: unknown) => {
				values[key] = value;
			},
			delete: (key: string) => {
				delete values[key];
			},
			save: jest.fn(),
		};
		const emptyTemplates = {
			list: async () => [],
			getContent: async () => undefined,
			add: jest.fn(),
			delete: jest.fn(),
		};
		const workspace = Object.create(EnterpriseWorkspace.prototype) as EnterpriseWorkspace;
		Reflect.set(workspace, "_config", config);
		Reflect.set(workspace, "_assets", {
			style: { getContent: async () => null, delete: jest.fn(), setContent: jest.fn() },
			logo: { getAll: async () => ({ light: null, dark: null }), delete: jest.fn(), set: jest.fn() },
			wordTemplates: emptyTemplates,
			pdfTemplates: emptyTemplates,
			plugins: { getAll: async () => ({ plugins: [] }), sync: jest.fn() },
		});
		Reflect.set(workspace, "_events", { emit: jest.fn() });
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					name: "Workspace",
					layout: { items: [{ type: "catalog", name: "guide" }] },
					modules: {},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		await workspace.config(true);

		expect(values.layout).toEqual({
			items: [{ type: "catalog", name: "guide" }],
			personal: {
				items: [
					{
						type: "section",
						id: "personal",
						title: "Personal",
						items: [{ type: "catalog", name: "notes" }],
					},
				],
			},
		});
		expect(values.personalSections).toBeUndefined();
	});
});
