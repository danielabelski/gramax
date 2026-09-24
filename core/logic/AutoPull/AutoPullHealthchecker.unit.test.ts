import { HealthcheckStatus, ModuleState } from "@ext/healthcheck/HealthChecker";
import { AutoPull, type AutoPullState } from "./AutoPull";
import { AutoPullHealthchecker } from "./AutoPullHealthchecker";

describe("AutoPullHealthchecker", () => {
	const setState = (autoPull: AutoPull, state: Partial<AutoPullState>) =>
		Reflect.set(autoPull, "_state", { ...autoPull.getState(), ...state });

	it("reports disabled auto-pull without affecting overall health", async () => {
		const healthchecker = new AutoPullHealthchecker(new AutoPull());

		const result = await healthchecker.check();

		expect(result).toMatchObject({ state: ModuleState.DISABLED, critical: false });
		expect(result.status).toBeUndefined();
	});

	it("maps a failed cycle to a non-critical health failure", async () => {
		const autoPull = new AutoPull();
		setState(autoPull, { mode: "interval", lastAttemptAt: Date.now(), lastCycleFailed: true });
		const healthchecker = new AutoPullHealthchecker(autoPull);

		await expect(healthchecker.check()).resolves.toMatchObject({
			state: ModuleState.ENABLED,
			status: HealthcheckStatus.UNHEALTHY,
			critical: false,
			code: "AUTO_PULL_FAILED",
		});
	});
});
