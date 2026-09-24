import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import ResourceManager from "@core/Resource/ResourceManager";

const manager = () => new ResourceManager({} as FileProvider, new Path("docs/article.md"));

const setAll = (...paths: string[]) => {
	const rm = manager();
	paths.forEach((path) => rm.set(new Path(path)));
	return rm.resources.map((resource) => resource.value);
};

describe("ResourceManager.set", () => {
	test("keeps an ordinary catalog-relative resource", () => {
		expect(setAll("image.png", "./image2.png", "assets/sub/file.docx")).toEqual([
			"image.png",
			"./image2.png",
			"assets/sub/file.docx",
		]);
	});

	test("keeps names a real attachment can have", () => {
		expect(setAll("скриншот 1.png", "./отчёт/итог 2026.docx", "../shared/a.b.c.png", "img/12:30 shot.png")).toEqual(
			["скриншот 1.png", "./отчёт/итог 2026.docx", "../shared/a.b.c.png", "img/12:30 shot.png"],
		);
	});

	test("keeps the same resource once", () => {
		expect(setAll("image.png", "./image.png")).toEqual(["image.png"]);
	});

	test("rejects an absolute URL whatever its scheme", () => {
		expect(
			setAll(
				"https://host/img.png",
				"http://host/img.png",
				"vscode-file://vscode-app/img.png",
				"data:image/png;base64,iVBORw0KGgo=",
				"mailto:someone@example.com",
			),
		).toEqual([]);
	});

	test("rejects a protocol-relative reference", () => {
		expect(setAll("//host.vscode-cdn.net/img.png")).toEqual([]);
	});

	test("rejects the vscode webview URL that produced *.net&parentOrigin=…", () => {
		const url =
			"https://host.vscode-cdn.net&parentOrigin=vscode-file%3A%2F%2Fvscode-app" +
			"&purpose=webviewView&session=c7e07c21-6758-4b47-8b7e-d57218af949f";

		expect(setAll(url)).toEqual([]);
		expect(setAll(url.replace("https://", "https:/"))).toEqual([]);
	});
});
