import type Application from "@app/types/Application";
import type ApiRequest from "@core/Api/ApiRequest";
import type ApiResponse from "@core/Api/ApiResponse";
import { MainMiddleware } from "@core/Api/middleware/MainMiddleware";
import { getHealthStatusCode } from "@ext/healthcheck/HealthChecker";
import { ApplyApiMiddleware } from "../../logic/Api/ApplyMiddleware";

export async function detailedHealthHandler(
	this: { app: Application },
	req: ApiRequest,
	res: ApiResponse,
): Promise<void> {
	const authorization = req?.headers?.authorization;
	const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
	const result = this.app.healthcheckRegistry
		? await this.app.healthcheckRegistry.health(token)
		: { status: "unavailable" as const };
	if (result.status === "unavailable") {
		res.statusCode = 503;
		res.send(result);
		return;
	}
	if (result.status === "unauthorized") {
		res.statusCode = 401;
		res.send(result);
		return;
	}

	res.statusCode = getHealthStatusCode(result.status);
	res.send({
		...result,
		service: "docportal",
		version: this.app.conf.version,
		timestamp: new Date().toISOString(),
	});
}

export default ApplyApiMiddleware(detailedHealthHandler, [new MainMiddleware()]);
