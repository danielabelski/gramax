import {
	type Healthchecker,
	type HealthcheckResult,
	HealthcheckStatus,
	ModuleState,
} from "@ext/healthcheck/HealthChecker";

export type SearchRuntimeHealth = {
	phase: "no-data" | "indexing" | "ready" | "failed";
	progress?: number;
	lastProgressAt?: number;
};

const STALLED_AFTER_MS = 5 * 60_000;

export class SearchHealthchecker implements Healthchecker {
	readonly name = "search";
	readonly critical = false;

	constructor(private readonly _getRuntimeHealth: () => SearchRuntimeHealth) {}

	async check(): Promise<HealthcheckResult> {
		const runtime = this._getRuntimeHealth();
		const data: HealthcheckResult["data"] = { phase: runtime.phase };
		if (runtime.progress !== undefined) data.progress = runtime.progress;
		if (runtime.lastProgressAt !== undefined) data.lastProgressAt = new Date(runtime.lastProgressAt).toISOString();

		if (runtime.phase === "failed") {
			return {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: false,
				code: "SEARCH_INDEX_FAILED",
				data,
			};
		}
		if (
			runtime.phase === "indexing" &&
			runtime.lastProgressAt !== undefined &&
			Date.now() - runtime.lastProgressAt > STALLED_AFTER_MS
		) {
			return {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: false,
				code: "SEARCH_INDEX_STALLED",
				data,
			};
		}
		return {
			state: ModuleState.ENABLED,
			status: runtime.phase === "indexing" ? HealthcheckStatus.DEGRADED : HealthcheckStatus.HEALTHY,
			critical: false,
			data,
		};
	}
}
