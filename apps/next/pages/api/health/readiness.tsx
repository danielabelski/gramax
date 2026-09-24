import type Application from "@app/types/Application";
import type ApiRequest from "@core/Api/ApiRequest";
import type ApiResponse from "@core/Api/ApiResponse";
import { MainMiddleware } from "@core/Api/middleware/MainMiddleware";
import { getHealthStatusCode, HealthcheckStatus } from "@ext/healthcheck/HealthChecker";
import { ApplyApiMiddleware } from "../../../logic/Api/ApplyMiddleware";

export async function readinessHandler(this: { app: Application }, _: ApiRequest, res: ApiResponse): Promise<void> {
	const status = this.app.healthcheckRegistry
		? await this.app.healthcheckRegistry.ready()
		: HealthcheckStatus.UNHEALTHY;
	res.statusCode = getHealthStatusCode(status);
	res.send({ status });
}

export default ApplyApiMiddleware(readinessHandler, [new MainMiddleware()]);
