import { HealthcheckStatus, ModuleState } from "@ext/healthcheck/HealthChecker";
import { SearchHealthchecker, type SearchRuntimeHealth } from "./SearchHealthchecker";

const check = async (snapshot: SearchRuntimeHealth) => await new SearchHealthchecker(() => snapshot).check();

describe("SearchHealthchecker", () => {
	it("reports no data as healthy", async () => {
		await expect(check({ phase: "no-data" })).resolves.toMatchObject({
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.HEALTHY,
			critical: false,
			data: { phase: "no-data" },
		});
	});

	it("reports active indexing as degraded", async () => {
		await expect(check({ phase: "indexing", progress: 0.5, lastProgressAt: Date.now() })).resolves.toMatchObject({
			status: HealthcheckStatus.DEGRADED,
			data: { phase: "indexing", progress: 0.5 },
		});
	});

	it("reports indexing stalled after five minutes", async () => {
		await expect(
			check({ phase: "indexing", progress: 0.5, lastProgressAt: Date.now() - 5 * 60_000 - 1 }),
		).resolves.toMatchObject({ status: HealthcheckStatus.UNHEALTHY, code: "SEARCH_INDEX_STALLED" });
	});

	it("reports indexing failure without exposing the error", async () => {
		await expect(check({ phase: "failed" })).resolves.toMatchObject({
			status: HealthcheckStatus.UNHEALTHY,
			code: "SEARCH_INDEX_FAILED",
		});
	});
});
