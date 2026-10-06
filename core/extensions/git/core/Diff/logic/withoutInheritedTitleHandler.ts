import ArticleTitleHelpers from "@ext/markdown/elements/article/edit/ArticleTitleHelpers";
import type { Extensions } from "@tiptap/core";

/**
 * The diff editor is built from the extension list of the last normal editor. That list carries
 * `ArticleTitleHelpers` configured with the callbacks of the editor it came from — an article that may
 * no longer be open — so a title typed or loaded in the diff would be saved to that article. The diff
 * editor configures its own handler instead.
 */
const withoutInheritedTitleHandler = (extensions: Extensions): Extensions =>
	extensions.filter((extension) => extension.name !== ArticleTitleHelpers.name);

export default withoutInheritedTitleHandler;
