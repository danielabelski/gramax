import type ApiRequest from "@core/Api/ApiRequest";
import type ApiResponse from "@core/Api/ApiResponse";
import { HealthcheckStatus } from "@ext/healthcheck/HealthChecker";

const livenessHandler = (_: ApiRequest, res: ApiResponse): void => {
	res.statusCode = 200;
	res.send({ status: HealthcheckStatus.HEALTHY });
};

export default livenessHandler;
