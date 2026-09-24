import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "@app/config/AppConfig";
import { testUnlessRoot } from "@app/test/canDenyAccess";
import MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import Path from "@core/FileProvider/Path/Path";
import FileStructureEventHandlers from "@core/FileStructue/events/FileStuctureEventHandlers";
import YamlFileConfig from "@core/utils/YamlFileConfig";
import RepositoryProvider from "@ext/git/core/Repository/RepositoryProvider";
import type { WorkspacePath } from "@ext/workspace/WorkspaceConfig";
import WorkspaceManager from "@ext/workspace/WorkspaceManager";

/**
 * A root path we are not allowed to read must not be treated as a root path that is gone. Point
 * Gramax at ~/Desktop before granting macOS Files & Folders access and the folder is right there
 * — we just may not look inside it.
 *
 * The contract: `addWorkspace` fails with a typed error the UI can key on (`GetErrorComponent`
 * dispatches on `props.errorCode`) carrying the folder to name, and startup absorbs that error so
 * it still lands on the "no workspace selected" screen with the refusal recorded.
 */
const ACCESS_DENIED_CODE = "workspace-access-denied";

type WorkspacesConfig = { workspaces: WorkspacePath[] };

const makeWm = (root = "", fallback = "") => {
	const config = YamlFileConfig.dummy<WorkspacesConfig>();
	const wm = new WorkspaceManager(
		(path) => MountFileProvider.fromDefault(new Path(path)),
		(fs) => new FileStructureEventHandlers(fs).mount(),
		() => [] as never,
		new RepositoryProvider(),
		{ paths: { root: new Path(root), default: new Path(fallback) } } as AppConfig,
		config,
	);
	return { wm, config };
};

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		// biome-ignore lint/suspicious/noExplicitAny: the whole point is inspecting error props
		(e: any) => e,
	);

describe("WorkspaceManager на недоступном root path", () => {
	let sandbox: string;
	let denied: string;
	let reachable: string;
	let fallback: string;

	beforeEach(() => {
		sandbox = mkdtempSync(join(tmpdir(), "gx-ws-access-"));
		denied = join(sandbox, "denied");
		reachable = join(sandbox, "reachable");
		fallback = join(sandbox, "fallback");
		mkdirSync(denied);
		mkdirSync(reachable);
		mkdirSync(fallback);
		chmodSync(denied, 0o000);
	});

	afterEach(() => {
		chmodSync(denied, 0o755);
		rmSync(sandbox, { recursive: true, force: true, maxRetries: 5 });
	});

	testUnlessRoot("addWorkspace бросает типизированную ошибку, а не «папки нет»", async () => {
		const error = await rejection(makeWm().wm.addWorkspace(denied));

		expect(error).not.toBeNull();
		expect(error.message).not.toMatch(/not exist/i);
		expect(error.props?.errorCode).toBe(ACCESS_DENIED_CODE);
		// One message for any refusal, and it has to read as a message — not the rustcall
		// passthrough ("Other: Permission denied (os error 13);\nargs: {...}") that lands in the
		// dialog body today.
		expect(error.message).not.toMatch(/os error|\bargs:/);
	});

	testUnlessRoot("типизированная ошибка несёт путь, который надо показать и дать сменить", async () => {
		const error = await rejection(makeWm().wm.addWorkspace(denied));

		expect(error?.props?.path).toBe(denied);
	});

	testUnlessRoot("отказ на workspace.yaml внутри читаемой директории тоже типизирован", async () => {
		// The refusal does not always land on the directory itself. Here the directory lists fine and
		// only the config inside is unreachable — `addWorkspace` gets past `isRootPathExists` and dies
		// later, in `_readWorkspace`. Without a guard around the whole call the raw rustcall text
		// reaches the user: `PermissionDenied: Permission denied (os error 13); args: {...}`.
		const config = join(reachable, "workspace.yaml");
		writeFileSync(config, "name: Test\n");
		chmodSync(config, 0o000);
		try {
			const error = await rejection(makeWm().wm.addWorkspace(reachable));

			expect(error?.props?.errorCode).toBe(ACCESS_DENIED_CODE);
			expect(error.message).not.toMatch(/os error|\bargs:/);
		} finally {
			chmodSync(config, 0o644);
		}
	});

	test("отсутствующая папка по-прежнему просто не даёт воркспейс", async () => {
		// The guard for the other direction: a genuinely missing folder is not an access
		// problem, and `create = false` must keep returning nothing rather than throwing.
		await expect(makeWm().wm.addWorkspace(join(sandbox, "missing"))).resolves.toBeUndefined();
	});

	testUnlessRoot("отказ при открытии воркспейса тоже типизирован", async () => {
		// Registering a workspace and opening it are separate trips to the disk, and access can be
		// revoked between them — macOS resets TCC on app update, someone chmods the directory. The
		// probe in `createRootPathIfNeed` cannot catch it either: `exists` on a directory that is
		// present but unreadable answers `true`, so it returns without touching anything and the
		// refusal lands further in, on the catalog scan inside `Workspace.init`.
		const { wm } = makeWm();
		const opened = join(sandbox, "opened");
		mkdirSync(opened);
		await wm.addWorkspace(opened, undefined, true);
		chmodSync(opened, 0o000);

		try {
			const error = await rejection(wm.setWorkspace(opened));

			expect(error?.props?.errorCode).toBe(ACCESS_DENIED_CODE);
			expect(error.message).not.toMatch(/os error|\bargs:/);
		} finally {
			chmodSync(opened, 0o755);
		}
	});

	testUnlessRoot("старт отдаёт отказ наверх — его ловит хендлер вокруг getPageData", async () => {
		// `getData` in the web app awaits `getApp()` (which reads the workspaces) and
		// `page/getPageData` inside one try/catch, and `AppError` dispatches on `props.errorCode`.
		// So the refusal only has to reach that boundary intact — no state to stash on the manager.
		const { wm, config } = makeWm(reachable, fallback);
		config.set("workspaces", [denied]);

		await expect(wm.readWorkspaces()).rejects.toMatchObject({
			props: { errorCode: ACCESS_DENIED_CODE, path: denied },
		});
	});

	testUnlessRoot("то же, когда недоступен сам paths.root", async () => {
		// The actual shape of the bug report: nothing in the workspace list yet, and the configured
		// default root is the folder macOS will not hand over. `_importWorkspaceFromRootPath` asks
		// `isRootPathExists` directly, so that call has to produce the same typed error.

		await expect(makeWm(denied, fallback).wm.readWorkspaces()).rejects.toMatchObject({
			props: { errorCode: ACCESS_DENIED_CODE, path: denied },
		});
	});
});
