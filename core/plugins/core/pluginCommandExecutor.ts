import FetchService from "@core-ui/ApiServices/FetchService";
import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import Url from "@core-ui/ApiServices/Types/Url";
import type { HttpCommandExecutor } from "../api/sdk/core";

export const pluginCommandExecutor: HttpCommandExecutor = {
	async execute<TResult = unknown>(path: string, args?: unknown): Promise<TResult> {
		const normalizedPath = path.replace(/^\/+/, "");
		const query = Object.fromEntries(
			Object.entries((args ?? {}) as Record<string, unknown>)
				.filter(([, value]) => value !== undefined)
				.map(([key, value]) => [key, String(value)]),
		);
		const response = await FetchService.fetch(
			Url.from({ pathname: `/api/${normalizedPath}`, query }),
			undefined,
			MimeTypes.json,
			Method.GET,
			false,
		);

		if (!response.ok) throw new Error(`Plugin command failed: ${normalizedPath} (${response.status})`);

		return response.json() as Promise<TResult>;
	},
};
