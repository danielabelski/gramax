import { testUnlessRoot } from "@app/test/canDenyAccess";
import fs from "fs";
import os from "os";
import path from "path";
import Path from "../../Path/Path";
import DiskFileProvider from "../DiskFileProvider";

/**
 * A macOS user who points Gramax at ~/Desktop before granting Files & Folders access sees
 * "Root path ... not exist" — the folder is right there, we just may not read it. The refusal
 * has to keep its name all the way up so the UI can offer System Settings and a different root
 * instead of claiming the folder is gone.
 *
 * `chmod 000` is the deterministic stand-in for TCC: same `EACCES`/`EPERM`, same code path.
 */
describe("DiskFileProvider на папке без прав доступа", () => {
	let root: string;
	let unreadable: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "gx-dfp-perm-"));
		unreadable = path.join(root, "denied");
		fs.mkdirSync(unreadable);
		fs.writeFileSync(path.join(unreadable, "child.md"), "content");
		fs.chmodSync(unreadable, 0o000);
	});

	afterEach(() => {
		fs.chmodSync(unreadable, 0o755);
		fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
	});

	describe("isRootPathExists", () => {
		testUnlessRoot("не выдаёт отказ в доступе за отсутствие папки", async () => {
			const dfp = new DiskFileProvider(unreadable);

			const error = await dfp.isRootPathExists().then(
				() => null,
				(e: Error) => e,
			);

			expect(error).not.toBeNull();
			expect(error.message).not.toMatch(/not exist/i);
		});

		testUnlessRoot("отдаёт отказ под именем PermissionDenied", async () => {
			const dfp = new DiskFileProvider(unreadable);

			await expect(dfp.isRootPathExists()).rejects.toMatchObject({ code: "PermissionDenied" });
		});

		testUnlessRoot("по-настоящему отсутствующая папка по-прежнему false", async () => {
			// The guard for the other direction: this `false` is what lets the workspace flow
			// offer to create the folder, and it must survive the fix.
			const dfp = new DiskFileProvider(path.join(root, "missing"));

			await expect(dfp.isRootPathExists()).resolves.toBe(false);
		});
	});

	describe("getItems", () => {
		testUnlessRoot("не выдаёт недоступную папку за пустую", async () => {
			const dfp = new DiskFileProvider(root);

			await expect(dfp.getItems(new Path("/denied"))).rejects.toMatchObject({ code: "PermissionDenied" });
		});
	});

	describe("exists", () => {
		testUnlessRoot("не отвечает false про путь, который нам не дали посмотреть", async () => {
			const dfp = new DiskFileProvider(root);

			await expect(dfp.exists(new Path("/denied/child.md"))).rejects.toMatchObject({
				code: "PermissionDenied",
			});
		});
	});
});
