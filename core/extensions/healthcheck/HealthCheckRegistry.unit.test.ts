import { getHealthStatusCode, type Healthchecker, HealthcheckStatus, ModuleState } from "./HealthChecker";
import { type AggregatedHealthResult, HealthcheckRegistry } from "./HealthCheckRegistry";

const checker = (name: string, result: Awaited<ReturnType<Healthchecker["check"]>>): Healthchecker => ({
	name,
	check: async () => result,
});

const health = async (registry: HealthcheckRegistry): Promise<AggregatedHealthResult> =>
	(await registry.health("secret")) as AggregatedHealthResult;

describe("HealthcheckRegistry", () => {
	test("returns health only for the configured token", async () => {
		const registry = new HealthcheckRegistry("secret");
		registry.register(checker("read-content", { status: HealthcheckStatus.HEALTHY }));

		expect(await registry.health()).toEqual({ status: "unauthorized" });
		expect(await registry.health("wrong")).toEqual({ status: "unauthorized" });
		expect(await registry.health("secret")).toMatchObject({ status: HealthcheckStatus.HEALTHY });
	});

	test("stays unavailable when the configured token is absent", async () => {
		expect(await new HealthcheckRegistry().health("secret")).toEqual({ status: "unavailable" });
	});

	test("returns degraded when a non-critical module is unhealthy", async () => {
		const registry = new HealthcheckRegistry("secret");
		registry.register(
			checker("search", {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: false,
				code: "SEARCH_INDEX_FAILED",
			}),
		);

		const result = await health(registry);

		expect(result.status).toBe(HealthcheckStatus.DEGRADED);
		expect(result.checks.search.code).toBe("SEARCH_INDEX_FAILED");
		expect(getHealthStatusCode(await registry.ready())).toBe(200);
	});

	test("returns unhealthy when a critical module is unhealthy", async () => {
		const registry = new HealthcheckRegistry("secret");
		registry.register(
			checker("read-content", {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: true,
			}),
		);

		expect(await registry.ready()).toBe(HealthcheckStatus.UNHEALTHY);
	});

	test("keeps disabled modules visible without affecting status", async () => {
		const registry = new HealthcheckRegistry("secret");
		registry.register(checker("auto-pull", { state: ModuleState.DISABLED, critical: false }));

		const result = await health(registry);

		expect(result.status).toBe(HealthcheckStatus.HEALTHY);
		expect(result.checks["auto-pull"]).toMatchObject({ state: ModuleState.DISABLED, critical: false });
		expect(result.checks["auto-pull"].status).toBeUndefined();
	});

	test("returns the total snapshot duration", async () => {
		const registry = new HealthcheckRegistry("secret");
		registry.register(
			checker("read-content", {
				status: HealthcheckStatus.HEALTHY,
				message: "internal detail",
				timestamp: new Date(),
			}),
		);

		const result = await health(registry);

		expect(result.durationMs).toEqual(expect.any(Number));
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		expect(result.checks["read-content"]).not.toHaveProperty("durationMs");
		expect(result.checks["read-content"]).not.toHaveProperty("message");
		expect(result.checks["read-content"]).not.toHaveProperty("timestamp");
	});

	test("sanitizes thrown errors", async () => {
		const registry = new HealthcheckRegistry("secret");
		registry.register({
			name: "search",
			critical: false,
			check: async () => {
				throw new Error("secret path /private/catalog");
			},
		});

		const result = await health(registry);

		expect(result.status).toBe(HealthcheckStatus.DEGRADED);
		expect(result.checks.search).toMatchObject({
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.UNHEALTHY,
			critical: false,
			code: "HEALTH_CHECK_FAILED",
		});
		expect(result.checks.search).not.toHaveProperty("message");
	});
});
