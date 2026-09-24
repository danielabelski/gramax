import StaticSiteBuilder from "./StaticSiteBuilder";

// #889 — static site build must derive <html lang> from the article's content
// language, not emit the template's hardcoded lang="ru" for every page.
const TEMPLATE = `<!doctype html>
<html lang="<!--html-lang-->">
<head><!--base-tag--><title><!--title-content--></title><!--app-data--><!--app-styles--></head>
<body><div id="root"><!--app-body--></div></body>
</html>`;

const parts = (contentLanguage?: string) => ({
	base: ".",
	title: "Article",
	data: "window.data = {}",
	body: "<p>hi</p>",
	styles: "",
	contentLanguage,
});

describe("StaticSiteBuilder.buildArticleHtml — html lang (#889)", () => {
	it("emits the article's content language on the root <html> tag", () => {
		const html = StaticSiteBuilder.buildArticleHtml(TEMPLATE, parts("en"));
		expect(html).toContain('<html lang="en">');
		expect(html).not.toContain('<html lang="ru">');
	});

	it("keeps a non-default language (not just en/ru)", () => {
		const html = StaticSiteBuilder.buildArticleHtml(TEMPLATE, parts("de"));
		expect(html).toContain('<html lang="de">');
	});

	it("falls back to the previous default when no language is known", () => {
		const html = StaticSiteBuilder.buildArticleHtml(TEMPLATE, parts(undefined));
		expect(html).toContain('<html lang="ru">');
		expect(html).not.toContain('<html lang="">');
	});

	it("leaves a template without the lang placeholder untouched", () => {
		const legacyTemplate = TEMPLATE.replace('<html lang="<!--html-lang-->">', '<html lang="ru">');
		const html = StaticSiteBuilder.buildArticleHtml(legacyTemplate, parts("en"));
		expect(html).toContain('<html lang="ru">');
		expect(html).toContain("<p>hi</p>");
	});

	it("still injects the other template slots", () => {
		const html = StaticSiteBuilder.buildArticleHtml(TEMPLATE, parts("en"));
		expect(html).toContain("<p>hi</p>");
		expect(html).toContain("<title>Article</title>");
		expect(html).toContain('<base href=".">');
	});
});

describe("StaticSiteBuilder.buildArticleHtml — unknown language", () => {
	it("ignores a language that is not a known ContentLanguage", () => {
		const html = StaticSiteBuilder.buildArticleHtml(TEMPLATE, parts('en"><script>alert(1)</script>'));
		expect(html).toContain('<html lang="ru">');
		expect(html).not.toContain('<html lang="">');
		expect(html).not.toContain("<script>alert(1)</script>");
	});
});
