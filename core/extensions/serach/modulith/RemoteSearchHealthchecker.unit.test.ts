import { HealthcheckStatus } from "@ext/healthcheck/HealthChecker";
import { RemoteSearchHealthchecker } from "./RemoteSearchHealthchecker";

describe("RemoteSearchHealthchecker", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("reports initializing without making the first check wait", async () => {
		const healthcheck = jest.fn().mockReturnValue(new Promise(() => {}));
		const checker = new RemoteSearchHealthchecker({ healthcheck } as never);

		expect(healthcheck).not.toHaveBeenCalled();

		await expect(
			Promise.race([checker.check(), Promise.resolve("check is waiting for remote search")]),
		).resolves.toMatchObject({
			status: HealthcheckStatus.DEGRADED,
			code: "REMOTE_SEARCH_INITIALIZING",
		});
		expect(healthcheck).toHaveBeenCalledTimes(1);
	});

	it("converts refresh errors to an unhealthy snapshot", async () => {
		const checker = new RemoteSearchHealthchecker({
			healthcheck: jest.fn().mockRejectedValue(new Error("secret connection details")),
		} as never);

		await expect(checker.check()).resolves.toMatchObject({
			status: HealthcheckStatus.DEGRADED,
			code: "REMOTE_SEARCH_INITIALIZING",
		});
		await Promise.resolve();
		await Promise.resolve();

		await expect(checker.check()).resolves.toEqual({
			state: "enabled",
			status: HealthcheckStatus.UNHEALTHY,
			critical: false,
			code: "REMOTE_SEARCH_UNREACHABLE",
		});
	});

	it("aborts a timed out refresh and can recover on the next interval", async () => {
		const healthcheck = jest
			.fn()
			.mockImplementationOnce(
				(signal: AbortSignal) =>
					new Promise((_resolve, reject) =>
						signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
					),
			)
			.mockResolvedValue({ ok: true });
		const checker = new RemoteSearchHealthchecker({ healthcheck } as never);

		await checker.check();
		await jest.advanceTimersByTimeAsync(10_000);
		await expect(checker.check()).resolves.toMatchObject({
			status: HealthcheckStatus.UNHEALTHY,
			code: "REMOTE_SEARCH_UNREACHABLE",
		});

		await jest.advanceTimersByTimeAsync(20_000);
		await expect(checker.check()).resolves.toMatchObject({ status: HealthcheckStatus.HEALTHY });
	});

	it("reports a stale snapshot separately from an unreachable service", async () => {
		jest.setSystemTime(new Date("2026-08-26T00:00:00Z"));
		const checker = new RemoteSearchHealthchecker({
			healthcheck: jest.fn().mockResolvedValue({ ok: true }),
		} as never);

		await checker.check();
		await Promise.resolve();
		await Promise.resolve();
		jest.setSystemTime(new Date("2026-08-26T00:01:31Z"));

		await expect(checker.check()).resolves.toMatchObject({
			status: HealthcheckStatus.UNHEALTHY,
			code: "HEALTH_DATA_STALE",
		});
	});
});
