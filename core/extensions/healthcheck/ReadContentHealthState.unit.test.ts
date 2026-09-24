import { HealthcheckStatus } from "./HealthChecker";
import { ReadContentHealthState } from "./ReadContentHealthState";

const NOW = Date.parse("2026-08-31T10:00:00Z");

describe("ReadContentHealthState", () => {
	test.each([
		[1, HealthcheckStatus.DEGRADED, "CONTENT_READ_ERRORS"],
		[2, HealthcheckStatus.DEGRADED, "CONTENT_READ_ERRORS"],
		[3, HealthcheckStatus.UNHEALTHY, "CONTENT_UNAVAILABLE"],
	] as const)("maps %s consecutive failures to %s", (failures, status, code) => {
		const state = new ReadContentHealthState(() => NOW);
		for (let count = 0; count < failures; count++) state.recordFailure();

		expect(state.snapshot(new Date(NOW))).toMatchObject({
			status,
			code,
			data: { consecutiveFailures: failures, lastFailureAt: "2026-08-31T10:00:00.000Z" },
		});
	});

	test("recovers after a successful real read", () => {
		const state = new ReadContentHealthState(() => NOW);
		state.recordFailure();
		state.recordFailure();

		state.recordSuccess();

		expect(state.snapshot(new Date(NOW))).toMatchObject({
			status: HealthcheckStatus.HEALTHY,
			data: { consecutiveFailures: 0, lastSuccessAt: "2026-08-31T10:00:00.000Z" },
		});
	});

	test("records an ordinary home page as a successful read", () => {
		const state = new ReadContentHealthState(() => NOW);

		state.observe({ page: "home", data: {}, context: {} } as never);

		expect(state.snapshot(new Date(NOW))).toMatchObject({
			status: HealthcheckStatus.HEALTHY,
			data: { lastSuccessAt: "2026-08-31T10:00:00.000Z" },
		});
	});

	test("records a fallback 500 as a failed read", () => {
		const state = new ReadContentHealthState(() => NOW);

		state.observe({ page: "article", data: { articleProps: { errorCode: 500 } }, context: {} } as never);

		expect(state.snapshot(new Date(NOW))).toMatchObject({
			status: HealthcheckStatus.DEGRADED,
			data: { consecutiveFailures: 1 },
		});
	});

	test.each([
		[{ page: "article", data: { articleProps: { errorCode: 404 } }, context: {} }, undefined],
		[{ page: "article", data: { articleProps: { errorCode: 500 } }, context: {} }, { diff: true }],
		[{ page: "article", data: { articleProps: { errorCode: 500 }, diff: {} }, context: {} }, undefined],
	] as const)("ignores reads that must not affect health", (page, options) => {
		const state = new ReadContentHealthState(() => NOW);

		state.observe(page as never, options as never);

		expect(state.snapshot(new Date(NOW))).toMatchObject({
			status: HealthcheckStatus.HEALTHY,
			data: { consecutiveFailures: 0 },
		});
	});
});
