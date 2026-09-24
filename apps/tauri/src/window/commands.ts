import { span } from "@ext/loggers/opentelemetry";
import { type InvokeArgs, type InvokeOptions, invoke as rawInvoke } from "@tauri-apps/api/core";
import { listen, once } from "@tauri-apps/api/event";
import { getAllWebviews } from "@tauri-apps/api/webview";
import { confirm } from "@tauri-apps/plugin-dialog";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export type HttpListenOnceAction = { type: "redirect"; value: string } | { type: "tryClose" };

export interface HttpListenOnceOptions {
	url: string;
	action: HttpListenOnceAction;
	callbackName: string;
}

export const invoke = <T>(cmd: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> => {
	const ctx = span()?.spanContext();

	return rawInvoke<T>(cmd, args, {
		...options,
		headers: {
			"span-id": ctx?.spanId,
			"trace-id": ctx?.traceId,
		},
	});
};

export const httpListenOnce = async ({ action, callbackName, url }: HttpListenOnceOptions) => {
	await invoke("http_listen_once", {
		url,
		action,
		callbackName,
	});
};

export const openChildWindow = async (opts: { url: string; redirect?: string }): Promise<Window> => {
	const dummy = { onLoadApp: undefined, focus: () => {} };
	await once("on_done", (ev) => dummy.onLoadApp({ search: `?${ev.payload as string}` }));

	if (opts.redirect) {
		void httpListenOnce({
			url: opts.url.replace(/redirect=.*$/, `redirect=${encodeURIComponent("http://localhost:52054")}`),
			action: { type: "redirect", value: opts.redirect },
			callbackName: "on_done",
		});
	} else {
		window.location.replace(opts.url);
	}

	return dummy as unknown as Window;
};

export const openDirectory = () => invoke<string>("open_directory");

export type HttpFetchOptions = {
	timeout?: { type: "off" } | { type: "on"; ms: number };
};

export const httpFetch = (
	input: Parameters<typeof tauriFetch>[0],
	init?: Parameters<typeof tauriFetch>[1],
	options?: HttpFetchOptions,
): Promise<Response> => {
	const timeout = options?.timeout ?? { type: "on" as const, ms: 30_000 };
	const requestSignal = init?.signal;

	let signal: AbortSignal | undefined;
	if (timeout.type === "off") signal = requestSignal;
	else if (requestSignal) signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeout.ms)]);
	else signal = AbortSignal.timeout(timeout.ms);

	return tauriFetch(input, {
		...init,
		connectTimeout: init?.connectTimeout ?? 10_000,
		signal,
	});
};

export const mailFetch = (req: {
	url: string;
	command?: string;
	body?: string;
	auth?: { username: string; password: string };
}): Promise<{
	status: string;
	statusText: string;
	ok: boolean;
	body: string;
	truncated: boolean;
}> => {
	return invoke("plugin:plugin-mail|mail_request", { req });
};

export const moveToTrash = (path: string) => invoke<void>("move_to_trash", { path });

export const openInExplorer = (path: string) => invoke<void>("open_in_explorer", { path });

export const openInWeb = (url: string) => invoke<void>("open_in_web", { url });

export const setSessionData = (key: string, data: string) => invoke<void>("set_session_data", { key, data });

export const openWindowWithUrl = (url: string) => invoke<void>("open_window_with_url", { url });

export const setBadge = (count: number | null) => invoke<void>("set_badge", { count });

export const historyBackForwardGo = (forward: boolean) => invoke<void>("history_back_forward_go", { forward });

export const historyBackForwardCanGo = () => invoke<[boolean, boolean]>("history_back_forward_can_go");

export type UpdateCheckResult = "up-to-date" | "update-found" | "in-progress";

/**
 * `update_check` downloads a found update before it returns. With `resolveOnFound` the promise settles
 * as soon as the update is found (download started or it was already cached); the download goes on in
 * the background and reports to the update toast through `update:*` events.
 */
export const updateCheck = async (clearCache: boolean, resolveOnFound = false): Promise<UpdateCheckResult> => {
	if (clearCache) await invoke<void>("update_cache_clear");
	if (!resolveOnFound) return invoke<UpdateCheckResult>("update_check");

	let onFound!: () => void;
	const found = new Promise<UpdateCheckResult>((resolve) => {
		onFound = () => resolve("update-found");
	});
	// Subscribe before invoking, otherwise an early `update:incoming` could be missed.
	const unlisten = await Promise.all([listen("update:incoming", onFound), listen("update:ready", onFound)]);

	const check = invoke<UpdateCheckResult>("update_check");
	// A download failure after an early return reaches the user through the `update:error` toast.
	check.catch(() => {});

	try {
		return await Promise.race([check, found]);
	} finally {
		for (const stop of unlisten) stop();
	}
};

export const updateInstall = () => invoke<void>("update_install");

export const updateCacheClear = () => invoke<void>("update_cache_clear");

export const updateInstallByPath = () => invoke<void>("update_install_by_path");

export const updateResetBytes = () => invoke<void>("update_reset_bytes");

const reloadAll = async () => {
	const webviews = await getAllWebviews();
	for (const webview of webviews) setTimeout(() => void webview.emit("reload"), 100);
};

export const restartApp = () => invoke<void>("restart_app");

(window.confirm as unknown) = async (message?: string) => {
	return await confirm(message);
};

Object.assign(window, {
	updateCheck,
	updateInstall,
	updateCacheClear,
	updateInstallByPath,
	updateResetBytes,
	setBadge,
	reloadAll,
	restartApp,
});
