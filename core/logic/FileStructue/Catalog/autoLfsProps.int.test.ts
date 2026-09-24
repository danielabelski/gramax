/**
 * @jest-environment node
 */

import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import Path from "@core/FileProvider/Path/Path";
import FileStructure from "@core/FileStructue/FileStructure";
import { DEFAULT_LFS_EXCLUDE, resolveLfsExclude } from "@core/GitLfs/logic/autoLfsAttachments";
import { seedAutoLfsProps } from "@core/GitLfs/logic/workspaceManagedLfs";

const dfp = new DiskFileProvider(__dirname);
const fp = MountFileProvider.fromDefault(new Path(__dirname));
const ROOT = "testAutoLfsProps";

describe("auto lfs props in .doc-root.yaml", () => {
	beforeEach(async () => {
		await dfp.mkdir(new Path(ROOT));
	});

	afterEach(async () => {
		await dfp.delete(new Path(ROOT));
	});

	test("a new catalog is created with the switch on and the diagram sources excluded", async () => {
		const fs = new FileStructure(fp, false);
		const catalog = await fs.createCatalog({ url: `${ROOT}/fresh`, title: "Fresh" });

		expect(catalog.props.lfs).toEqual({ auto: true, exclude: [] });

		// The exclusions it works by, which are the defaults: they hold without being written down.
		const effective = resolveLfsExclude(undefined, catalog.props.lfs);
		expect(effective).toEqual(DEFAULT_LFS_EXCLUDE);
		expect(effective).toContain("*.svg");
		expect(effective).toContain("*.html");
		expect(effective).not.toContain("*.png");

		const yaml = await dfp.read(new Path([ROOT, "fresh", ".doc-root.yaml"]));
		expect(yaml).toContain("auto: true");
		// No copy of the defaults on disk, so a later change to them reaches this catalog too.
		for (const pattern of DEFAULT_LFS_EXCLUDE) expect(yaml).not.toContain(pattern);
	});

	test("a catalog born in a workspace that manages the masks starts with the switch off", async () => {
		const fs = new FileStructure(fp, false);
		const managed = { config: () => Promise.resolve({ git: { lfs: { patterns: ["*.png"] } } }) } as never;

		const catalog = await fs.createCatalog({
			url: `${ROOT}/managed`,
			title: "Managed",
			lfs: await seedAutoLfsProps(managed),
		});

		expect(catalog.props.lfs.auto).toBe(false);
		expect(catalog.props.lfs.exclude).toEqual([]);
		expect(await dfp.read(new Path([ROOT, "managed", ".doc-root.yaml"]))).toContain("auto: false");
	});

	test("a catalog born in a plain workspace keeps the switch on", async () => {
		const plain = { config: () => Promise.resolve({}) } as never;

		expect(await seedAutoLfsProps(plain)).toEqual({ auto: true, exclude: [] });
	});

	test("explicit lfs props from the caller win over the defaults", async () => {
		const fs = new FileStructure(fp, false);
		const catalog = await fs.createCatalog({
			url: `${ROOT}/custom`,
			title: "Custom",
			lfs: { auto: false, exclude: [] },
		});

		expect(catalog.props.lfs).toEqual({ auto: false, exclude: [] });
	});
});
