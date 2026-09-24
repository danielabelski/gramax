/**
 * Turning an XHR outcome into something wasm can report.
 *
 * `xhr.response` with responseType "arraybuffer" is an ArrayBuffer on success and `null`
 * whenever the request never reached the server (DNS failure, offline, CORS rejection).
 * ArrayBuffer has no `.length`, so nothing here may assume an array-like body.
 */

const decoder = new TextDecoder();
const MAX_BODY_BYTES = 4096;

/**
 * Status recorded when XHR reports 0 — the request never reached the server. 0 itself
 * is useless downstream: it carries no meaning for libgit2, and `-0` is indistinguishable
 * from success for the C callers. Mirrored in `LibGit2Error.fromRaw` on the app side.
 */
export const NETWORK_ERROR_STATUS = 999;

/**
 * Return value for a failed read/send. libgit2's emscripten transport reads -999 as
 * "request aborted" (`libgit2-sys/emscripten-transport/emscriptenhttp-async.c`), so a network
 * failure must not reuse it — it would be reported to the user as a cancelled operation.
 */
export const NETWORK_TRANSPORT_ERROR = -998;

export type XhrBody = ArrayBufferLike | ArrayBufferView | string | null | undefined;

export type HttpError = { status: number; body: string };

// Checked by shape, not by `instanceof`: a buffer handed over from another realm (a worker,
// or jsdom in tests) fails the class check while being a perfectly good ArrayBuffer.
const toBytes = (body: XhrBody): Uint8Array => {
	if (!body) return new Uint8Array(0);
	if (typeof body === "string") return new TextEncoder().encode(body);
	if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
	if (typeof (body as ArrayBufferLike).byteLength === "number") return new Uint8Array(body as ArrayBufferLike);
	return new Uint8Array(0);
};

const unreachableMessage = (url?: string): string => {
	if (!url) return "Failed to send request: the server is unreachable, or the network blocks it";

	let domain = url;
	try {
		domain = new URL(url).hostname;
	} catch {
		// a proxied url may be relative — keep it as-is
	}

	return `Failed to send request to '${url}': domain '${domain}' unreachable or CORS headers incorrect`;
};

/** Returns null when the response is not an error, otherwise what to hand `set_last_http_error`. */
export const buildHttpError = (status: number, body: XhrBody, url?: string): HttpError | null => {
	if (status >= 200 && status < 300) return null;

	const bytes = toBytes(body);
	const decoded = decoder.decode(bytes.byteLength > MAX_BODY_BYTES ? bytes.slice(0, MAX_BODY_BYTES) : bytes);

	if (status === 0) return { status: NETWORK_ERROR_STATUS, body: decoded || unreachableMessage(url) };

	return { status, body: decoded };
};

/** Maps a recorded error status to the code the wasm callers expect: negative, and never -999. */
export const toTransportError = (errStatus: number): number =>
	!errStatus || errStatus === NETWORK_ERROR_STATUS ? NETWORK_TRANSPORT_ERROR : -errStatus;
