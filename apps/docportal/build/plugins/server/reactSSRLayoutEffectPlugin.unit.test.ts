import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { OnLoadCallback, PluginConstraints } from "bun";
import ts from "typescript";
import { reactSSRLayoutEffectPlugin } from "./reactSSRLayoutEffectPlugin";

jest.mock(
	"bun",
	() => ({
		file: (filePath: string) => ({ text: () => require("node:fs").promises.readFile(filePath, "utf8") }),
	}),
	{ virtual: true },
);

test("keeps multiline imports valid when inserting the SSR layout effect helper", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "react-ssr-layout-effect-"));
	const sourcePath = path.join(directory, "component.ts");
	await writeFile(
		sourcePath,
		`import { useLayoutEffect } from "react";
import type { Options } from "./options";
import {
  createValue,
  type Value,
} from "./values";

export const useValue = () => useLayoutEffect(() => createValue<Value>(), []);
`,
	);

	try {
		let transform:
			| ((args: { path: string }) => Promise<{ contents: string; loader: string } | undefined>)
			| undefined;
		const plugin = reactSSRLayoutEffectPlugin();
		plugin.setup({
			onLoad: (_options: PluginConstraints, callback: OnLoadCallback) => {
				transform = callback as typeof transform;
			},
		} as never);

		const result = await transform?.({ path: sourcePath });
		expect(result).toBeDefined();
		const compiled = ts.transpileModule(result?.contents ?? "", {
			compilerOptions: { module: ts.ModuleKind.ESNext },
			reportDiagnostics: true,
		});
		expect(compiled.diagnostics).toEqual([]);
		expect(result?.contents).toContain("useIsomorphicLayoutEffect(()");
	} finally {
		await rm(directory, { recursive: true });
	}
});
