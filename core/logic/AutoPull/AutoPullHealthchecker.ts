import {
	type Healthchecker,
	type HealthcheckResult,
	HealthcheckStatus,
	ModuleState,
} from "@ext/healthcheck/HealthChecker";
import type { AutoPull } from "./AutoPull";

export class AutoPullHealthchecker implements Healthchecker {
	readonly name = "auto-pull";
	readonly critical = false;

	constructor(private readonly _autoPull: AutoPull) {}

	async check(): Promise<HealthcheckResult> {
		const state = this._autoPull.getState();
		if (state.startFailed) {
			return {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: false,
				code: "AUTO_PULL_INIT_FAILED",
			};
		}
		if (state.mode === "disabled") return { state: ModuleState.DISABLED, critical: false };
		if (state.mode === "webhook-only") {
			return {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.HEALTHY,
				critical: false,
				data: { mode: "webhook-only" },
			};
		}

		const data: HealthcheckResult["data"] = { mode: "interval" };
		if (!state.lastAttemptAt) data.phase = "waiting";
		if (state.lastAttemptAt) data.lastAttemptAt = new Date(state.lastAttemptAt).toISOString();
		if (state.lastSuccessAt) data.lastSuccessAt = new Date(state.lastSuccessAt).toISOString();
		if (state.nextRunAt) data.nextRunAt = new Date(state.nextRunAt).toISOString();

		if (state.lastAttemptAt && state.pullInterval && Date.now() - state.lastAttemptAt > state.pullInterval * 2) {
			return {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: false,
				code: "AUTO_PULL_STALE",
				data,
			};
		}
		if (state.lastCycleFailed) {
			return {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: false,
				code: "AUTO_PULL_FAILED",
				data,
			};
		}
		if (state.lastSummary?.failed) {
			return {
				state: ModuleState.ENABLED,
				status: HealthcheckStatus.UNHEALTHY,
				critical: false,
				code: "AUTO_PULL_FAILED",
				data: { ...data, failedCatalogs: state.lastSummary.failedCatalogs },
			};
		}
		return { state: ModuleState.ENABLED, status: HealthcheckStatus.HEALTHY, critical: false, data };
	}
}
