/** @jest-environment node */
import { ResponseKind } from "@app/types/ResponseKind";
import api from "./api";

describe("docportal API responses", () => {
	test("returns the response before the iterator completes", async () => {
		let finishIterator!: () => void;
		const iteratorFinished = new Promise<void>((resolve) => {
			finishIterator = resolve;
		});
		const iterator = (async function* () {
			yield '{"progress":1}\n';
			await iteratorFinished;
		})();
		const command = {
			// biome-ignore lint/style/useNamingConvention: matches the Command runtime shape
			_c: { path: "search/getIndexingProgress" },
			kind: ResponseKind.stream,
			params: jest.fn(() => ({})),
			do: jest.fn(async () => ({ mime: "application/x-ndjson", iterator })),
		};
		const request = new Request("https://portal.example/api/search/getIndexingProgress");
		const context = {
			path: new URL(request.url),
			req: { bunReq: request },
			res: { mergeInto: (response: Response) => response },
			app: { contextFactory: { fromNode: jest.fn(async () => ({})) } },
			commands: { search: { getIndexingProgress: command } },
		};

		const response = await Promise.race([
			api(context as never),
			new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
		]);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) return;
		expect(response.headers.get("Content-Type")).toBe("application/x-ndjson");
		const reader = response.body.getReader();
		const firstChunk = await reader.read();
		expect(new TextDecoder().decode(firstChunk.value)).toBe('{"progress":1}\n');
		finishIterator();
		await reader.cancel();
	});
});
