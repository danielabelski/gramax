import { AgentAttachmentStore } from "./attachmentStore";

const createFileStore = () => {
	const files = new Map<string, string>();
	return {
		files,
		writeFile: jest.fn(async (path: string, content: string) => {
			files.set(path, content);
		}),
		readFile: jest.fn(async (path: string) => files.get(path) ?? null),
		listDir: jest.fn(async (dir: string) =>
			[...files.keys()].filter((path) => path.startsWith(`${dir}/`)).map((path) => path.slice(dir.length + 1)),
		),
		deletePath: jest.fn(async (path: string) => {
			files.delete(path);
		}),
	};
};

describe("AgentAttachmentStore", () => {
	test("stores original bytes as base64", async () => {
		const fileStore = createFileStore();
		const store = new AgentAttachmentStore(fileStore as never);
		const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
		const [saved] = await store.put("sess-1", [
			{
				name: "doc.pdf",
				mime: "application/pdf",
				size: bytes.byteLength,
				content: Buffer.from(bytes).toString("base64"),
				contentEncoding: "base64",
			},
		]);

		expect(saved.originalFilename).toBe("doc.pdf");
		expect(saved.storagePath).toBe("sessions/sess-1/attachments/doc.pdf");
		expect(fileStore.files.get(saved.storagePath)).toBe(Buffer.from(bytes).toString("base64"));
		expect(await store.getBytes("sess-1", "doc.pdf")).toEqual(bytes);
	});

	test("keeps download.bin bytes as-is", async () => {
		const fileStore = createFileStore();
		const store = new AgentAttachmentStore(fileStore as never);
		const bytes = Uint8Array.from([0, 1, 2, 255]);
		await store.put("sess-1", [
			{
				name: "download.bin",
				mime: "application/octet-stream",
				size: bytes.byteLength,
				content: Buffer.from(bytes).toString("base64"),
			},
		]);
		expect(await store.getBytes("sess-1", "download.bin")).toEqual(bytes);
	});

	test("unique-names colliding attachments", async () => {
		const fileStore = createFileStore();
		const store = new AgentAttachmentStore(fileStore as never);
		const content = Buffer.from("hello").toString("base64");
		await store.put("sess-1", [{ name: "notes.txt", mime: "text/plain", size: 5, content }]);
		const [second] = await store.put("sess-1", [{ name: "notes.txt", mime: "text/plain", size: 5, content }]);
		expect(second.originalFilename).toBe("notes-2.txt");
	});
});
