import { followRenamedPath, trackRenameInFlight, whenRenameSettled } from "./renameInFlight";

// Everything the client sends about the open article is addressed by path, and a rename moves it
// before the response says where. Actions started in that window wait here and follow the move.

describe("a rename in flight", () => {
	test("nothing to wait for when no rename is running", async () => {
		expect(await whenRenameSettled()).toBeUndefined();
	});

	test("holds up a caller until the rename answers, and reports the move", async () => {
		let land: (move: { from: string; to: string }) => void = () => undefined;
		trackRenameInFlight(new Promise((resolve) => (land = resolve)));

		let settled: unknown = "still waiting";
		const waiter = whenRenameSettled().then((move) => {
			settled = move;
		});

		await Promise.resolve();
		expect(settled).toBe("still waiting");

		land({ from: "cat/untitled.md", to: "cat/alpha.md" });
		await waiter;
		expect(settled).toEqual({ from: "cat/untitled.md", to: "cat/alpha.md" });
	});

	test("is over once it has answered", async () => {
		trackRenameInFlight(Promise.resolve({ from: "a.md", to: "b.md" }));
		await whenRenameSettled();

		expect(await whenRenameSettled()).toBeUndefined();
	});
});
describe("following a rename", () => {
	const article = { from: "cat/untitled.md", to: "cat/alpha.md" };
	const section = { from: "cat/untitled/_index.md", to: "cat/alpha/_index.md" };

	test("the renamed article itself", () => {
		expect(followRenamedPath("cat/untitled.md", article)).toBe("cat/alpha.md");
	});

	test("a neighbour of the renamed article stays where it is", () => {
		expect(followRenamedPath("cat/other.md", article)).toBe("cat/other.md");
	});

	test("everything inside a renamed section moves with its folder", () => {
		expect(followRenamedPath("cat/untitled/_index.md", section)).toBe("cat/alpha/_index.md");
		expect(followRenamedPath("cat/untitled/child.md", section)).toBe("cat/alpha/child.md");
		expect(followRenamedPath("cat/untitled/deep/leaf.md", section)).toBe("cat/alpha/deep/leaf.md");
	});

	test("a section with a similar name is not swept along", () => {
		expect(followRenamedPath("cat/untitled-notes/child.md", section)).toBe("cat/untitled-notes/child.md");
	});
});
