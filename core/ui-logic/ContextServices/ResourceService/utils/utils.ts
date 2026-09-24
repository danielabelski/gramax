import { getExecutingEnvironment } from "@app/resolveModule/env";
import resolveModule from "@app/resolveModule/frontend";
import type Path from "@core/FileProvider/Path/Path";
import { isLikelyLfsPointer } from "@core/GitLfs/logic/isLikelyLfsPointer";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import {
	LfsPointerError,
	type ResourceError,
	ResourceLoadError,
	ResourceNotFoundError,
} from "@core-ui/ContextServices/ResourceService/errors";
import type { ArticleProviderType } from "@ext/articleProvider/logic/ArticleProvider";

export type ResourceFetchResult = { buffer?: Buffer; error?: ResourceError };

interface LoadInternalDataProps {
	src: string;
	apiUrlCreator: ApiUrlCreator;
	catalogName: string;
	id: string;
	provider: ArticleProviderType;
	signal?: AbortSignal;
}

export function checkLfsPointer(buffer: Buffer, src: string): ResourceError | undefined {
	if (isLikelyLfsPointer(buffer)) return new LfsPointerError(src);
	return undefined;
}

export async function fetchImage(src: string, signal?: AbortSignal): Promise<ResourceFetchResult> {
	try {
		const res = await fetch(src, { signal });
		if (!res.ok) {
			return { error: new ResourceNotFoundError(src) };
		}
		const blob = await res.blob();
		const buffer = Buffer.from(new Uint8Array(await blob.arrayBuffer()));
		return { buffer };
	} catch (e) {
		return { error: new ResourceLoadError(src, e instanceof Error ? e : undefined) };
	}
}

export async function fetchInTauri(src: string, signal?: AbortSignal): Promise<ResourceFetchResult> {
	try {
		const res = await resolveModule("httpFetch")(src, { signal });
		if (!res) {
			return { error: new ResourceNotFoundError(src) };
		}
		const contentType = res.headers.get("content-type");
		const buffer = Buffer.from(await res.arrayBuffer());
		if (contentType?.includes("application/json") || contentType?.includes("text")) {
			return { error: new ResourceNotFoundError(src) };
		}
		return { buffer };
	} catch (e) {
		return { error: new ResourceLoadError(src, e instanceof Error ? e : undefined) };
	}
}

export async function loadExternalData(src: string, signal?: AbortSignal): Promise<ResourceFetchResult> {
	const result =
		getExecutingEnvironment() === "tauri" ? await fetchInTauri(src, signal) : await fetchImage(src, signal);
	return result;
}

export async function loadInternalData(props: LoadInternalDataProps): Promise<ResourceFetchResult> {
	const { src, apiUrlCreator, catalogName, id, provider, signal } = props;
	const url = apiUrlCreator.getArticleResource(src, undefined, catalogName, id, provider);
	try {
		const res = await FetchService.fetch(url, undefined, MimeTypes.text, Method.POST, false, undefined, signal);
		if (!res.ok) {
			return { error: new ResourceNotFoundError(src) };
		}
		const buffer = await res.buffer();
		const lfsError = checkLfsPointer(buffer, src);
		if (lfsError) return { error: lfsError };
		return { buffer };
	} catch (e) {
		return { error: new ResourceLoadError(src, e instanceof Error ? e : undefined) };
	}
}

export async function getNoParentResource(
	path: Path,
	apiUrlCreator: ApiUrlCreator,
	signal?: AbortSignal,
): Promise<ResourceFetchResult> {
	const url = apiUrlCreator.getResourceByPath(path.value);
	try {
		const res = await FetchService.fetch(url, undefined, MimeTypes.text, Method.POST, false, undefined, signal);
		if (!res.ok) {
			return { error: new ResourceNotFoundError(path.value) };
		}
		const buffer = await res.buffer();
		const lfsError = checkLfsPointer(buffer, path.value);
		if (lfsError) return { error: lfsError };
		return { buffer };
	} catch (e) {
		return {
			error: new ResourceLoadError(path.value, e instanceof Error ? e : undefined),
		};
	}
}
