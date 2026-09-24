import { CATEGORY_ROOT_FILENAMES, DOC_ROOT_FILENAMES } from "@app/config/const";
import isLfsServiceFile from "@core/GitLfs/logic/isLfsServiceFile";

describe("isLfsServiceFile", () => {
	it("covers every doc-root spelling the loader accepts", () => {
		for (const name of DOC_ROOT_FILENAMES) expect(isLfsServiceFile(name)).toBe(true);
	});

	it("covers the category root", () => {
		for (const name of CATEGORY_ROOT_FILENAMES) expect(isLfsServiceFile(name)).toBe(true);
	});

	it("covers the files git itself parses", () => {
		expect(isLfsServiceFile(".gitattributes")).toBe(true);
		expect(isLfsServiceFile(".gitignore")).toBe(true);
	});

	it("matches by name, so a nested one counts too", () => {
		expect(isLfsServiceFile("docs/nested/.doc-root.yaml")).toBe(true);
		expect(isLfsServiceFile("docs/_index.md")).toBe(true);
		expect(isLfsServiceFile("docs/.gitignore")).toBe(true);
	});

	it("leaves ordinary content alone", () => {
		expect(isLfsServiceFile("docs/article.md")).toBe(false);
		expect(isLfsServiceFile("docs/diagram.yaml")).toBe(false);
		expect(isLfsServiceFile("docs/schema.psd")).toBe(false);
		expect(isLfsServiceFile("docs/my.doc-root.yaml")).toBe(false);
	});
});
