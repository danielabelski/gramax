import Path from "@core/FileProvider/Path/Path";
import assert from "assert";
import { HttpRequest } from "./httpRequest";

export class NexaraAPI {
	private constructor() {}

	private static readonly _mimeByExt: Record<string, string> = {
		mp3: "audio/mp3",
		wav: "audio/wav",
		m4a: "audio/x-m4a",
		flac: "audio/flac",
		ogg: "audio/ogg",
		opus: "audio/opus",
		mp4: "video/mp4",
		mov: "video/quicktime",
		avi: "video/x-msvideo",
		mkv: "video/x-matroska",
	};

	static async transcribe(params: {
		apiKey: string;
		file?: { filename: string; bytes: Uint8Array };
		url?: string;
	}): Promise<string> {
		assert(params.apiKey.trim(), "apiKey is required");
		assert(!!params.file || !!params.url, "file or url is required");
		assert(!(params.file && params.url), "file and url are mutually exclusive");

		const file = params.file ? NexaraAPI._prepareFile(params.file) : undefined;
		const response = await HttpRequest.request({
			url: "https://api.nexara.ru/v1/audio/transcriptions",
			method: "POST",
			headers: { Authorization: `Bearer ${params.apiKey}` },
			timeoutMs: 300_000,
			body: {
				type: "multipart",
				fields: [
					...(file
						? [{ name: "file", filename: file.filename, mime: file.mime, data: file.bytes }]
						: [{ name: "url", value: params.url! }]),
					{ name: "model", value: "whisper-1" },
					{ name: "language", value: "ru" },
					{ name: "response_format", value: "json" },
				],
			},
		});

		assert(response.ok, `Transcription failed with status ${response.status}: ${response.body}`);

		try {
			const parsed = JSON.parse(response.body) as { text?: string };
			return typeof parsed.text === "string" ? parsed.text : response.body;
		} catch {
			return response.body;
		}
	}

	private static _prepareFile(file: { filename: string; bytes: Uint8Array }): {
		filename: string;
		mime: string;
		bytes: Uint8Array;
	} {
		const filename = new Path(file.filename).nameWithExtension ?? file.filename;
		const ext = new Path(filename).extension?.toLowerCase();
		const mime = ext ? NexaraAPI._mimeByExt[ext] : undefined;
		assert(mime, `unsupported file extension: ${filename}`);
		return { filename, mime, bytes: file.bytes };
	}
}
