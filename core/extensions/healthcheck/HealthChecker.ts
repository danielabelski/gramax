export interface HealthcheckResult {
	state?: ModuleState;
	status?: HealthcheckStatus;
	critical?: boolean;
	code?: string;
	traceId?: string;
	data?: Record<string, string | number | boolean | string[] | number[] | boolean[]>;
	checkedAt?: Date;
	message?: string;
	timestamp?: Date;
}

export enum HealthcheckStatus {
	HEALTHY = "healthy",
	DEGRADED = "degraded",
	UNHEALTHY = "unhealthy",
}

export const getHealthStatusCode = (status: HealthcheckStatus): number =>
	status === HealthcheckStatus.UNHEALTHY ? 503 : 200;

export enum ModuleState {
	ENABLED = "enabled",
	DISABLED = "disabled",
	MISCONFIGURED = "misconfigured",
}

export interface Healthchecker {
	readonly name: string;
	readonly critical?: boolean;
	check(): Promise<HealthcheckResult>;
}
