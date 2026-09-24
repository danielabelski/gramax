import Path from "@core/FileProvider/Path/Path";
import Theme from "@ext/Theme/Theme";
import deleteLogo from "./deleteLogo";

const makeWorkspace = (props: { logo?: string; logo_dark?: string }, deleteFile: jest.Mock) => ({
	getBaseCatalog: jest.fn().mockResolvedValue({
		props,
		getRootCategoryDirectoryPath: () => new Path("/catalog"),
	}),
	getFileProvider: () => ({ delete: deleteFile }),
});

describe("catalog/logo/delete command", () => {
	it("deletes the file of the requested theme", async () => {
		const deleteFile = jest.fn().mockResolvedValue(undefined);
		const workspace = makeWorkspace({ logo: "logo.svg", logo_dark: "logo_dark.svg" }, deleteFile);
		Reflect.set(deleteLogo, "_app", { wm: { current: () => workspace } });

		await deleteLogo.do({ catalogName: "Catalog", theme: Theme.dark, content: "" });

		expect(deleteFile).toHaveBeenCalledWith(new Path("/catalog/logo_dark.svg"));
	});

	it("keeps the file when the other theme still points at it", async () => {
		const deleteFile = jest.fn().mockResolvedValue(undefined);
		const workspace = makeWorkspace({ logo: "logo.svg", logo_dark: "logo.svg" }, deleteFile);
		Reflect.set(deleteLogo, "_app", { wm: { current: () => workspace } });

		await deleteLogo.do({ catalogName: "Catalog", theme: Theme.dark, content: "" });

		expect(deleteFile).not.toHaveBeenCalled();
	});
});
