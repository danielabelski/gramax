import { HealthcheckStatus, ModuleState } from "./HealthChecker";
import { ReadContentHealthchecker } from "./ReadContentHealthchecker";
import { ReadContentHealthState } from "./ReadContentHealthState";

const NOW = Date.parse("2026-08-31T10:00:00Z");

const createChecker = ({
	config = async () => ({}),
	getAllCatalogs = () => new Map([["docs", {}]]),
	now = () => NOW,
}: {
	config?: () => Promise<unknown>;
	getAllCatalogs?: () => Map<string, unknown>;
	now?: () => number;
} = {}) => {
	const forbidden = () => {
		throw new Error("heavy catalog probe was called");
	};
	const workspace = {
		config,
		getAllCatalogs,
		getContextlessCatalog: forbidden,
	};
	const state = new ReadContentHealthState(now);
	return {
		checker: new ReadContentHealthchecker({ current: () => workspace } as never, state, undefined, now),
		state,
	};
};

describe("ReadContentHealthchecker", () => {
	test("returns initializing immediately while the first workspace probe is running", async () => {
		const { checker } = createChecker({ config: async () => await new Promise(() => {}) });

		await expect(Promise.race([checker.check(), Promise.resolve("blocked")])).resolves.toMatchObject({
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.UNHEALTHY,
			code: "CONTENT_CHECK_INITIALIZING",
		});
	});

	test("uses only workspace config and catalog count for the background probe", async () => {
		const { checker } = createChecker();

		await checker.refresh();

		expect(await checker.check()).toMatchObject({
			status: HealthcheckStatus.HEALTHY,
			data: { catalogs: 1, consecutiveFailures: 0 },
		});
	});

	test("reports an unavailable workspace", async () => {
		let now = NOW;
		const { checker } = createChecker({
			config: async () => {
				throw new Error("private workspace path");
			},
			now: () => now,
		});

		await checker.refresh();
		now += 1_000;
		const result = await checker.check();

		expect(result).toMatchObject({ status: HealthcheckStatus.UNHEALTHY, code: "CONTENT_UNAVAILABLE" });
		expect(result.checkedAt).toEqual(new Date(NOW));
		expect(JSON.stringify(result)).not.toContain("private workspace path");
	});

	test("does not let a successful workspace probe reset real read failures", async () => {
		const { checker, state } = createChecker();
		state.recordFailure();
		state.recordFailure();

		await checker.refresh();

		expect(await checker.check()).toMatchObject({
			status: HealthcheckStatus.DEGRADED,
			data: { consecutiveFailures: 2 },
		});
	});

	test("times out a workspace probe after ten seconds", async () => {
		jest.useFakeTimers();
		try {
			const { checker } = createChecker({ config: async () => await new Promise(() => {}) });
			const refresh = checker.refresh();
			jest.advanceTimersByTime(10_000);
			await refresh;

			expect(await checker.check()).toMatchObject({
				status: HealthcheckStatus.UNHEALTHY,
				code: "CONTENT_UNAVAILABLE",
			});
		} finally {
			jest.useRealTimers();
		}
	});

	test("marks a workspace snapshot older than fifteen minutes as stale", async () => {
		let now = NOW;
		const { checker } = createChecker({ now: () => now });
		await checker.refresh();
		now += 15 * 60_000 + 1;

		expect(await checker.check()).toMatchObject({
			status: HealthcheckStatus.UNHEALTHY,
			code: "HEALTH_DATA_STALE",
			checkedAt: new Date(NOW),
		});
	});
});
