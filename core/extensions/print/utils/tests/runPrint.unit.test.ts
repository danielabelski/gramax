import { runPrint } from "../runPrint";

describe("runPrint", () => {
	const wait = () => Promise.resolve();

	it("waits for layout to settle before starting print", async () => {
		const calls: string[] = [];

		await runPrint({
			wait: async () => {
				calls.push("wait");
			},
			print: () => {
				calls.push("print");
			},
		});

		expect(calls).toEqual(["wait", "print"]);
	});

	it("waits for an asynchronous print before completing", async () => {
		let resolvePrint: () => void;
		const printFinished = new Promise<void>((resolve) => {
			resolvePrint = resolve;
		});
		const onComplete = jest.fn();
		const onError = jest.fn();

		const running = runPrint({ onComplete, onError, print: () => printFinished, wait });
		await Promise.resolve();
		await Promise.resolve();

		expect(onComplete).not.toHaveBeenCalled();

		resolvePrint();
		await running;

		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});

	it("completes after a synchronous print", async () => {
		const onComplete = jest.fn();
		const onError = jest.fn();
		const print = jest.fn();

		await runPrint({ onComplete, onError, print, wait });

		expect(print).toHaveBeenCalledTimes(1);
		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});

	it("reports a rejected print and does not complete", async () => {
		const onComplete = jest.fn();
		const onError = jest.fn();
		const error = new Error("print failed");

		await runPrint({ onComplete, onError, print: () => Promise.reject(error), wait });

		expect(onError).toHaveBeenCalledWith(error);
		expect(onComplete).not.toHaveBeenCalled();
	});

	it("reports a throwing print and does not complete", async () => {
		const onComplete = jest.fn();
		const onError = jest.fn();
		const error = new Error("no printer");

		await runPrint({
			onComplete,
			onError,
			print: () => {
				throw error;
			},
			wait,
		});

		expect(onError).toHaveBeenCalledWith(error);
		expect(onComplete).not.toHaveBeenCalled();
	});

	it("reports an error thrown by completion", async () => {
		const error = new Error("cleanup failed");
		const onError = jest.fn();

		await runPrint({
			onComplete: () => {
				throw error;
			},
			onError,
			print: () => undefined,
			wait,
		});

		expect(onError).toHaveBeenCalledWith(error);
	});
});
