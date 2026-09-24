import { createEventEmitter } from "@core/Event/EventEmitter";
import Path from "@core/FileProvider/Path/Path";
import CatalogEntry from "@core/FileStructue/Catalog/CatalogEntry";
import type FileStructure from "@core/FileStructue/FileStructure";
import type { FSEvents } from "@core/FileStructue/FileStructure";
import type Repository from "@ext/git/core/Repository/Repository";
import type { Workspace } from "@ext/workspace/Workspace";
import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";
import ManagedStoragePathnameResolver from "./ManagedStoragePathnameResolver";

describe("ManagedStoragePathnameResolver", () => {
	it("формирует URL через событие и учитывает изменения конфигурации workspace", async () => {
		const fs = { events: createEventEmitter<FSEvents>() } as FileStructure;
		let config: Partial<WorkspaceConfig> = {};
		const workspace = {
			getFileStructure: () => fs,
			config: async () => config,
		} as Workspace;
		const entry = new CatalogEntry({
			fs,
			name: "repo",
			basePath: new Path("repo"),
			rootCaterogyRef: { storageId: "test", path: new Path("repo/_index.md") },
			isReadOnly: false,
			props: {},
			load: jest.fn(),
		});
		entry.setRepository({
			storage: {
				getSourceName: async () => "ges.example.com",
				getGroup: async () => "team",
				getName: async () => "repo",
			},
			gvc: { getCurrentBranchName: async () => "main" },
		} as unknown as Repository);

		expect(await entry.getPathname()).toBe("ges.example.com/team/repo/main/-");
		new ManagedStoragePathnameResolver(workspace).mount();
		config = { enterprise: { gesUrl: "https://ges.example.com" } };
		expect(await entry.getPathname()).toBe("team/repo/main/-");
		expect(await entry.getPathnameData()).toEqual({
			sourceName: "ges.example.com",
			group: "team",
			repo: "repo",
			refname: "main",
			catalogName: "repo",
			itemLogicPath: undefined,
		});
		config = { enterpriseCloud: { url: "https://ges.example.com" } };
		expect(await entry.getPathname()).toBe("team/repo/main/-");
		config = { enterprise: { gesUrl: "https://another.example.com" } };
		expect(await entry.getPathname()).toBe("ges.example.com/team/repo/main/-");
	});
});
