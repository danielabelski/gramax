import { act, renderHook } from "@testing-library/react";
import { createArticleTitleUpdateQueue, useArticleTitleUpdateQueue } from "./ArticleTitleUpdateQueue";

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe("ArticleTitleUpdateQueue", () => {
	test("waits for the previous title update before starting the next one", async () => {
		const first = deferred();
		const started: string[] = [];
		const queue = createArticleTitleUpdateQueue(async (title) => {
			started.push(title);
			if (title === "First") await first.promise;
		});

		const firstUpdate = queue("First");
		const secondUpdate = queue("Second");
		await Promise.resolve();

		expect(started).toEqual(["First"]);

		first.resolve();
		await Promise.all([firstUpdate, secondUpdate]);

		expect(started).toEqual(["First", "Second"]);
	});

	test("keeps title updates ordered across a rerender", async () => {
		const first = deferred();
		const started: string[] = [];
		const update = async (title: string) => {
			started.push(title);
			if (title.endsWith("First")) await first.promise;
		};
		const view = renderHook(
			({ renderId }) => useArticleTitleUpdateQueue(async (title) => update(`${renderId}:${title}`)),
			{ initialProps: { renderId: 1 } },
		);

		const firstUpdate = view.result.current("First");
		await Promise.resolve();
		view.rerender({ renderId: 2 });
		const secondUpdate = view.result.current("Second");
		await Promise.resolve();

		expect(started).toEqual(["1:First"]);

		await act(async () => first.resolve());
		await Promise.all([firstUpdate, secondUpdate]);

		expect(started).toEqual(["1:First", "2:Second"]);
	});

	test("drop() skips an update still waiting to run", async () => {
		const first = deferred();
		const started: string[] = [];
		const queue = createArticleTitleUpdateQueue(async (title) => {
			started.push(title);
			if (title === "First") await first.promise;
		});

		const firstUpdate = queue("First");
		await Promise.resolve(); // let "First" actually start before anything is dropped

		const droppedUpdate = queue("Stale title from a different article");
		queue.drop();
		first.resolve();
		await Promise.all([firstUpdate, droppedUpdate]);

		expect(started).toEqual(["First"]);
	});

	test("drop() does not affect an update already sent to the caller", async () => {
		const started: string[] = [];
		const queue = createArticleTitleUpdateQueue(async (title) => {
			started.push(title);
		});

		await queue("First");
		queue.drop();
		await queue("First");

		// The duplicate-suppression state was cleared by drop(), so the repeated title runs again.
		expect(started).toEqual(["First", "First"]);
	});
});
