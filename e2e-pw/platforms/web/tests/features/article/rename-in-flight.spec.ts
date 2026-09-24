import { expect } from "@playwright/test";
import { editorTest } from "@web/fixtures/editor.fixture";

// A rename moves the file on disk before the client learns the new path. A write sent into that
// window is addressed to the old path — the server does not find it and drops it silently. The
// window lasts a fraction of a millisecond, so the spec opens it itself: the rename response is
// delayed, with the disk work already done by then.

editorTest.use({
	startUrl: "/-/-/-/-/flight/untitled",
	firstEnter: false,
	files: {
		flight: {
			"doc-root.yml": "title: Flight\n",
			"untitled.md": "",
		},
	},
});

const RENAME_RESPONSE_DELAY = 2000;

type WriteLog = { command: "rename" | "content"; phase: "in" | "out"; path?: string };

editorTest(
	"an edit made while the rename is in flight reaches the renamed file",
	async ({ editor, basePage, sharedPage }) => {
		await sharedPage.evaluate((delay) => {
			const w = window as unknown as {
				commands: Record<string, Record<string, { do: (params: unknown) => Promise<unknown> }>>;
				gxWriteLog: WriteLog[];
			};
			w.gxWriteLog = [];

			const watch = (group: string, name: string, command: "rename" | "content", delayMs: number) => {
				const cmd = w.commands[group]![name]!;
				const original = cmd.do.bind(cmd);
				cmd.do = async (params: unknown) => {
					const path = params as { articlePath?: { value?: string }; props?: { ref?: { path?: string } } };
					w.gxWriteLog.push({ command, phase: "in", path: path.articlePath?.value ?? path.props?.ref?.path });
					const result = await original(params);
					if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
					w.gxWriteLog.push({ command, phase: "out" });
					return result;
				};
			};

			watch("item", "updateProps", "rename", delay);
			watch("article", "updateContent", "content", 0);
		}, RENAME_RESPONSE_DELAY);

		await editor.type("Flight Title");
		await editor.press("End ArrowDown");
		await editor.type("in-flight body");

		await sharedPage.waitForURL(/flight-title/, { timeout: 25_000 });
		await basePage.waitForLoad();

		// Reads the real file, not the editor: what was lost was the write to disk.
		expect(await editor.markdown()).toContain("in-flight body");

		// The text alone is not enough: an incidental second write could carry it. Assert the last
		// write was addressed to the new path — that is the actual fix.
		const log = await sharedPage.evaluate(() => (window as unknown as { gxWriteLog: WriteLog[] }).gxWriteLog);
		const lastContentWrite = log.filter((entry) => entry.command === "content" && entry.phase === "in").at(-1);

		expect(lastContentWrite?.path, `full write log: ${JSON.stringify(log)}`).toContain("flight-title.md");
	},
);
