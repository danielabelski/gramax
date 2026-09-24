import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { Attachment } from "../utils/attachment";
import { NexaraAPI } from "../utils/nexara";

type TranscribeAudioInput = {
	attachmentItemPath: string;
};

export async function runTranscribeAudio(context: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { app, input } = context;
	const { attachmentItemPath } = input as TranscribeAudioInput;

	const apiKey = app.agentManager.secrets.get("NEXARA_API_KEY")?.token;
	if (!apiKey) {
		return fail("Missing secret: NEXARA_API_KEY", { secrets: ["NEXARA_API_KEY"] });
	}

	try {
		const parsed = Attachment.parsePath(attachmentItemPath);
		if (parsed.kind === "url") {
			return ok(await NexaraAPI.transcribe({ apiKey, url: parsed.url }));
		}

		const file = await Attachment.load(parsed, context);
		return ok(await NexaraAPI.transcribe({ apiKey, file }));
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to transcribe audio: ${msg}`);
	}
}
