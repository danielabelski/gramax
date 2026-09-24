import resolveModule from "@app/resolveModule/frontend";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";

const MAIL_PROTOCOLS = ["imaps:", "smtps:"] as const;

type MailRequestInput = {
	url: string;
	command?: string;
	body?: string;
	auth?: { username: string; password: string };
};

export async function runMailRequest({ input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { url, command, body, auth } = input as MailRequestInput;
	if (!url?.trim()) return fail("url is required");

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return fail(`Invalid url: ${url}`);
	}

	if (!(MAIL_PROTOCOLS as readonly string[]).includes(parsedUrl.protocol)) {
		return fail(`Only imaps and smtps URLs are supported, got: ${parsedUrl.protocol}`);
	}

	try {
		const result = await resolveModule("mailFetch")({
			url: parsedUrl.toString(),
			command: command?.trim() || undefined,
			body,
			auth,
		});
		return ok(result);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Mail request failed: ${msg}`);
	}
}
