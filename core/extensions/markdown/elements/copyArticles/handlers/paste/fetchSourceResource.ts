import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import { loadInternalData } from "@core-ui/ContextServices/ResourceService/utils/utils";
import {
	type ClipboardOrigin,
	isSameClipboardOrigin,
} from "@ext/markdown/elements/copyArticles/handlers/clipboardOrigin";
import type { ClipboardSource } from "@ext/markdown/elements/copyArticles/handlers/copy";

/**
 * Reads a copied resource straight from the article it was copied from.
 *
 * The editor loads an image only once it nears the viewport, and copy can only put into the clipboard what the
 * cache already holds — so every image the user never scrolled to travels without its bytes. Rather than paste a
 * src pointing at a file the target article has no copy of, fetch the original here, at paste time.
 */
const fetchSourceResource = async (
	name: string,
	source: ClipboardSource,
	apiUrlCreator: ApiUrlCreator,
	target: ClipboardOrigin,
): Promise<Buffer> => {
	if (!name || !source?.catalogName || !apiUrlCreator) return null;
	// An external address (a video, an image by URL) has no file in the source catalog to read.
	if (/^[a-z][a-z\d+.-]*:/i.test(name)) return null;
	// Another workspace or server may hold a same-named catalog with a different file at that path.
	if (!isSameClipboardOrigin(source.origin, target)) return null;

	// loadInternalData rejects an un-pulled LFS pointer, which must not be saved as the pasted image.
	const { buffer } = await loadInternalData({
		src: name,
		apiUrlCreator,
		catalogName: source.catalogName,
		id: source.itemId || source.articlePath,
		provider: source.provider,
	});
	return buffer?.length ? buffer : null;
};

export default fetchSourceResource;
