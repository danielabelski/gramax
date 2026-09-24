import { HealthcheckStatus } from "@ext/healthcheck/HealthChecker";
import { readinessHandler } from "./readiness";

describe("Next readiness probe", () => {
	it.each([
		[HealthcheckStatus.HEALTHY, 200],
		[HealthcheckStatus.DEGRADED, 200],
		[HealthcheckStatus.UNHEALTHY, 503],
	])("returns minimal readiness for %s", async (status, expectedCode) => {
		const send = jest.fn();
		const res = { statusCode: 0, send };

		await readinessHandler.call(
			{ app: { healthcheckRegistry: { ready: async () => status } } } as never,
			{} as never,
			res as never,
		);

		expect(res.statusCode).toBe(expectedCode);
		expect(send).toHaveBeenCalledWith({ status });
	});

	it("returns 503 when the registry is unavailable", async () => {
		const send = jest.fn();
		const res = { statusCode: 0, send };

		await readinessHandler.call({ app: {} } as never, {} as never, res as never);

		expect(res.statusCode).toBe(503);
		expect(send).toHaveBeenCalledWith({ status: HealthcheckStatus.UNHEALTHY });
	});
});
