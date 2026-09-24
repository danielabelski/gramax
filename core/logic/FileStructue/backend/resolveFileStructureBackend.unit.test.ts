import type MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";

/**
 * The environment is read once at module load, so each case needs its own module registry.
 * `resolveFileStructureBackend` never touches the provider — it only hands it to a constructor.
 */
const backendKindFor = (environment: string): string => {
	let kind: string;

	jest.isolateModules(() => {
		jest.doMock("@app/resolveModule/env", () => ({
			getExecutingEnvironment: () => environment,
			env: () => "",
			isTauriMobile: () => false,
		}));

		const resolve = require("@core/FileStructue/backend/resolveFileStructureBackend").default;
		kind = resolve({} as MountFileProvider, []).kind;
	});

	return kind;
};

describe("resolveFileStructureBackend", () => {
	afterEach(() => jest.resetModules());

	// The Rust scan is the implementation everywhere it exists. Anything shipped with a scan but
	// silently walking the tree in JS would be thousands of round trips per catalog load.
	test.each(["web", "tauri", "next", "docportal"])("%s reads through the Rust backend", (environment) => {
		expect(backendKindFor(environment)).toBe("native");
	});

	// No scan commands behind `rustCall` in these two — the static build answers fs calls from a
	// listing embedded in the page, the CLI answers them from Node's `fs`.
	test.each(["static", "cli"])("%s falls to the JS walk", (environment) => {
		expect(backendKindFor(environment)).toBe("js");
	});
});
