import type { ResourceServiceType } from "@core-ui/ContextServices/ResourceService/ResourceService";
import createImages from "@ext/markdown/elements/image/edit/logic/createImages";
import type { EditorView } from "prosemirror-view";

// A browser's "copy image" puts the picture on the clipboard as a file and, alongside it, the <img>
// tag in text/html and the image url in text/plain. Those two are not a rich fragment to hand over
// to the html paste path: it has no rule for a bare <img>, so the picture is dropped on the way.
const htmlHasTextContent = (html: string) => {
	const { body } = new DOMParser().parseFromString(html, "text/html");
	body.querySelectorAll("img, picture, svg").forEach((node) => node.remove());
	return body.textContent.trim().length > 0;
};

const imageHandlePaste = (
	view: EditorView,
	event: ClipboardEvent,
	fileName: string,
	resourceService: ResourceServiceType,
) => {
	if (event.clipboardData.files.length === 0) return false;
	const hasPlainText = event.clipboardData.getData("text/plain");
	const hasHtml = event.clipboardData.getData("text/html");

	if (hasPlainText && hasHtml && htmlHasTextContent(hasHtml)) return false;

	for (const item of event.clipboardData.items) {
		if (item.type.startsWith("image")) {
			const file = item.getAsFile();
			if (!file) continue;
			void createImages([file], view, fileName, resourceService);
			return true;
		}
	}
};

export default imageHandlePaste;
