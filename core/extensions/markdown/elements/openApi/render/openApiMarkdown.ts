import { renderMarkdownItHtml, renderMarkdownItInlineHtml, use } from "@ext/markdown/core/render/logic/Markdoc";
import type { MarkdownRenderer } from "@gramax/openapi-viewer";

/** Outer box: carries the width, the shadows, and nothing that scrolls. */
export const TABLE_SCROLL_CLASS = "openapi-table-scroll";
/** Inner box: the one that actually scrolls, and the one the frame is drawn on. */
export const TABLE_PORT_CLASS = "openapi-table-port";

/**
 * A table wider than the article has to scroll, and a reader has to be able to see that it can. Both need an
 * element around the table: a shadow pinned to the edge of a scroll box cannot be a child of that box, or it
 * scrolls away with the content. The markdown-it renderer is where that element comes from, so the shape is
 * in the DOM from the first paint and does not depend on anything running afterwards.
 *
 * `renderMarkdownItHtml` has one caller — this file — so overriding the table rules on the shared tokenizer
 * reaches OpenAPI descriptions and nothing else. Tokenizing is untouched; only the rendering of a table is.
 */
use((md) => {
	md.renderer.rules.table_open = () => `<div class="${TABLE_SCROLL_CLASS}"><div class="${TABLE_PORT_CLASS}"><table>`;
	md.renderer.rules.table_close = () => "</table></div></div>";
}, TABLE_SCROLL_CLASS);

/**
 * Article Markdown never produces an `h1`: `ArticleContentHeader` renders a level-1 heading as `<h2>`,
 * because `h1` is the article's own title. A description reaches the page through markdown-it instead, so
 * `# ` in a spec -- how specs are normally written -- came out as an `h1` larger than the title of the API
 * it describes, and the PDF export reads an `h1` in the page content as "a new article starts here".
 *
 * Same rule as the article renderer, one level down the whole way, so a description keeps the hierarchy its
 * author wrote instead of collapsing `#` and `##` into one level. Applies to every description the viewer
 * renders -- tags, operations, parameters, responses -- where an `h1` is even less at home than at the root.
 */
use((md) => {
	const demoted = (tag: string) => {
		const level = Number(tag.slice(1));
		return level >= 1 && level < 6 ? `h${level + 1}` : tag;
	};

	// Rendered through renderToken with the tag swapped back afterwards: attributes a plugin may have put
	// on the heading survive, and the token stays what it was for anything that renders it after us.
	const renderHeading: NonNullable<typeof md.renderer.rules.heading_open> = (tokens, idx, options, _env, self) => {
		const token = tokens[idx];
		const original = token.tag;
		token.tag = demoted(original);
		const html = self.renderToken(tokens, idx, options);
		token.tag = original;
		return html;
	};

	md.renderer.rules.heading_open = renderHeading;
	md.renderer.rules.heading_close = renderHeading;
}, "openapi-heading-level");

/**
 * Descriptions inside an OpenAPI block are Markdown, and Gramax already has a renderer for Markdown — this
 * hands the viewer that one instead of letting it carry a second, weaker parser. The same source text then
 * reads the same way whether it sits in an article or in a spec's `description`.
 *
 * Headings rendered here are plain markup and nothing else: the article's table of contents is built from the
 * parsed article tree, and an API block's own navigation from the spec's tags and operations. Neither reads
 * the DOM, so a `#` inside a description stays a heading in a paragraph and never becomes a TOC entry.
 */
const renderOpenApiMarkdown: MarkdownRenderer = (markdown, { inline }) =>
	inline ? renderMarkdownItInlineHtml(markdown) : renderMarkdownItHtml(markdown);

export default renderOpenApiMarkdown;
