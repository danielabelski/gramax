import { ResponseKind } from "@app/types/ResponseKind";
import { NexaraAPI } from "@ext/agent/mcp/utils/nexara";
import assert from "assert";
import { Command } from "../../../types/Command";

const messageTranscribeAudio: Command<{ audioBase64: string; filename: string }, { text: string }> = Command.create({
	path: "agent/message/transcribeAudio",

	kind: ResponseKind.json,

	flags: ["otel-omit-args"],

	async do({ audioBase64, filename }) {
		assert(audioBase64, "agent/message/transcribeAudio: empty_audio");
		assert(filename, "agent/message/transcribeAudio: empty_filename");

		const apiKey = this._app.agentManager.secrets.get("NEXARA_API_KEY")?.token;
		assert(apiKey, "agent/message/transcribeAudio: missing_secret");

		const bytes = Uint8Array.from(Buffer.from(audioBase64, "base64"));
		assert(bytes.byteLength > 0, "agent/message/transcribeAudio: empty_audio");

		const text = await NexaraAPI.transcribe({
			apiKey,
			file: { filename, bytes },
		});
		return { text };
	},

	params(_ctx, _q, body) {
		const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
		return {
			audioBase64: String(payload.audioBase64 ?? "").trim(),
			filename: String(payload.filename ?? "").trim(),
		};
	},
});

export default messageTranscribeAudio;
