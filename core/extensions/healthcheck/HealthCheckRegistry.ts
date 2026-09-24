import { Level, span, trace } from "@ext/loggers/opentelemetry";
import { type Healthchecker, type HealthcheckResult, HealthcheckStatus, ModuleState } from "./HealthChecker";

export interface AggregatedHealthResult {
	status: HealthcheckStatus;
	durationMs: number;
	checks: Record<string, HealthcheckResult>;
}

export type HealthResult = AggregatedHealthResult | { status: "unauthorized" | "unavailable" };

const normalizeResult = (result: HealthcheckResult, defaultCritical = true): HealthcheckResult => {
	const { message: _message, timestamp, status, ...safeResult } = result;
	const state = result.state ?? ModuleState.ENABLED;
	return {
		...safeResult,
		state,
		...(state === ModuleState.DISABLED
			? {}
			: {
					status:
						status ??
						(state === ModuleState.MISCONFIGURED ? HealthcheckStatus.UNHEALTHY : HealthcheckStatus.HEALTHY),
				}),
		critical: result.critical ?? defaultCritical,
		checkedAt: result.checkedAt ?? timestamp ?? new Date(),
	};
};

export class HealthcheckRegistry {
	private readonly _checkers: Healthchecker[] = [];

	constructor(private readonly _token?: string) {}

	async health(token?: string): Promise<HealthResult> {
		if (!this._token) return { status: "unavailable" };
		if (token !== this._token) return { status: "unauthorized" };
		return await this._checkAll();
	}

	async ready(): Promise<HealthcheckStatus> {
		return (await this._checkAll()).status;
	}

	register(checker: Healthchecker): void {
		this._checkers.push(checker);
	}

	@trace({ level: Level.Important })
	private async _checkAll(): Promise<AggregatedHealthResult> {
		const snapshotStart = performance.now();
		const results: { name: string; result: HealthcheckResult }[] = await Promise.all(
			this._checkers.map(async (checker) => {
				try {
					const result = await checker.check();
					return {
						name: checker.name,
						result: normalizeResult(result, checker.critical ?? true),
					};
				} catch (error) {
					const activeSpan = span();
					activeSpan?.recordException(error instanceof Error ? error : new Error(String(error)));
					const traceId = activeSpan?.spanContext().traceId;
					return {
						name: checker.name,
						result: {
							state: ModuleState.ENABLED,
							status: HealthcheckStatus.UNHEALTHY,
							critical: checker.critical ?? true,
							code: "HEALTH_CHECK_FAILED",
							...(traceId ? { traceId } : {}),
							checkedAt: new Date(),
						},
					};
				}
			}),
		);
		const checks: AggregatedHealthResult["checks"] = {};
		let overallStatus = HealthcheckStatus.HEALTHY;
		for (const { name, result } of results) {
			checks[name] = result;
			if (result.state === ModuleState.DISABLED) continue;
			if (result.status === HealthcheckStatus.UNHEALTHY) {
				if (result.critical !== false) overallStatus = HealthcheckStatus.UNHEALTHY;
				else if (overallStatus === HealthcheckStatus.HEALTHY) overallStatus = HealthcheckStatus.DEGRADED;
			} else if (result.status === HealthcheckStatus.DEGRADED && overallStatus === HealthcheckStatus.HEALTHY) {
				overallStatus = HealthcheckStatus.DEGRADED;
			}
		}

		return { status: overallStatus, durationMs: performance.now() - snapshotStart, checks };
	}
}
