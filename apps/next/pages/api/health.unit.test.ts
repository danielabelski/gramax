import { HealthcheckStatus } from "@ext/healthcheck/HealthChecker";
import { detailedHealthHandler } from "./health";

const call = async (authorization?: string, withRegistry = true) => {
	const send = jest.fn();
	const res = { statusCode: 0, send };
	await detailedHealthHandler.call(
		{
			app: {
				conf: { version: "1.0.0" },
				healthcheckRegistry: withRegistry
					? {
							health: async (token?: string) =>
								token === "health-secret"
									? { status: HealthcheckStatus.DEGRADED, durationMs: 2, checks: {} }
									: { status: "unauthorized" },
						}
					: undefined,
			},
		} as never,
		{ headers: authorization ? { authorization } : {} } as never,
		res as never,
	);
	return { res, send };
};

describe("Next detailed health", () => {
	it("returns 401 without the bearer token", async () => {
		const { res } = await call();
		expect(res.statusCode).toBe(401);
		expect((await call("Basic health-secret")).res.statusCode).toBe(401);
	});

	it("returns the protected service snapshot", async () => {
		const { res, send } = await call("Bearer health-secret");
		expect(res.statusCode).toBe(200);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				status: HealthcheckStatus.DEGRADED,
				service: "docportal",
				version: "1.0.0",
				durationMs: 2,
				timestamp: expect.any(String),
			}),
		);
	});

	it("returns unavailable when the registry is unavailable", async () => {
		const { res, send } = await call("Bearer health-secret", false);
		expect(res.statusCode).toBe(503);
		expect(send).toHaveBeenCalledWith({ status: "unavailable" });
	});
});
