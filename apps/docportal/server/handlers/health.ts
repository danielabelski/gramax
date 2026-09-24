import { getHealthStatusCode, HealthcheckStatus } from "@ext/healthcheck/HealthChecker";
import type ServerContext from "../types/ServerContext";

const health = async (serverContext: ServerContext) => {
	const { path, app, req } = serverContext;
	const isLive = path.pathname === "/health/liveness";
	const isReady = path.pathname === "/health/readiness";
	const isDetailed = path.pathname === "/health";
	if (!isLive && !isReady && !isDetailed) return;

	if (isLive) return serverContext.json(200, { status: HealthcheckStatus.HEALTHY });

	if (isDetailed) {
		const authorization = req?.headers?.authorization;
		const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
		const result = app.healthcheckRegistry
			? await app.healthcheckRegistry.health(token)
			: { status: "unavailable" as const };
		if (result.status === "unavailable") return serverContext.json(503, result);
		if (result.status === "unauthorized") return serverContext.json(401, result);
		return serverContext.json(getHealthStatusCode(result.status), {
			...result,
			service: "docportal",
			version: app.conf.version,
			timestamp: new Date().toISOString(),
		});
	}

	const result = app.healthcheckRegistry ? await app.healthcheckRegistry.ready() : HealthcheckStatus.UNHEALTHY;
	return serverContext.json(getHealthStatusCode(result), { status: result });
};

export default health;
