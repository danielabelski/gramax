import isLfsArticleFile from "@core/GitLfs/logic/isLfsArticleFile";

describe("isLfsArticleFile", () => {
	it("covers markdown wherever it sits", () => {
		expect(isLfsArticleFile("article.md")).toBe(true);
		expect(isLfsArticleFile("docs/nested/article.md")).toBe(true);
		expect(isLfsArticleFile("docs/_index.md")).toBe(true);
		expect(isLfsArticleFile("docs/README.MD")).toBe(true);
	});

	it("leaves attachments and diagram sources alone", () => {
		for (const relPath of ["docs/img.png", "docs/schema.psd", "docs/diagram.yaml", "docs/data.yml"]) {
			expect(isLfsArticleFile(relPath)).toBe(false);
		}
	});

	it("leaves an extensionless file and a dotfile alone", () => {
		expect(isLfsArticleFile("docs/Makefile")).toBe(false);
		expect(isLfsArticleFile(".gitattributes")).toBe(false);
	});
});
