import { HealthcheckStatus } from "@ext/healthcheck/HealthChecker";
import health from "./health";

const createContext = (
	pathname: string,
	authorization?: string,
	status = HealthcheckStatus.HEALTHY,
	withRegistry = true,
	healthAvailable = true,
) => {
	const response = {
		statusCode: 0,
		headers: {} as Record<string, string>,
		body: "",
		setHeader(name: string, value: string) {
			this.headers[name] = value;
		},
		send(body: string) {
			this.body = body;
		},
		getBunResponse() {
			return { body: this.body, status: this.statusCode, headers: this.headers };
		},
	};

	return {
		context: {
			path: new URL(`https://portal.example${pathname}`),
			req: { headers: authorization ? { authorization } : {} },
			res: response,
			app: {
				conf: { version: "1.0.0" },
				healthcheckRegistry: withRegistry
					? {
							ready: jest.fn(async () => status),
							health: jest.fn(async (token?: string) =>
								healthAvailable && token === "health-secret"
									? { status, durationMs: 2, checks: {} }
									: { status: healthAvailable ? "unauthorized" : "unavailable" },
							),
						}
					: undefined,
			},
			json(statusCode: number, body: Record<string, unknown>) {
				response.statusCode = statusCode;
				response.setHeader("Content-Type", "application/json");
				response.send(JSON.stringify(body));
				return response.getBunResponse();
			},
		} as never,
		response,
	};
};

describe("docportal health endpoints", () => {
	test("liveness returns a minimal response without authorization", async () => {
		const { context, response } = createContext("/health/liveness");

		await health(context);

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toEqual({ status: "healthy" });
	});

	test("readiness returns 503 only for an unhealthy service", async () => {
		const { context, response } = createContext("/health/readiness", undefined, HealthcheckStatus.UNHEALTHY);

		await health(context);

		expect(response.statusCode).toBe(503);
		expect(JSON.parse(response.body)).toEqual({ status: "unhealthy" });
	});

	test("detailed health requires the configured bearer token", async () => {
		const missing = createContext("/health");
		const wrong = createContext("/health", "Bearer wrong");
		const wrongScheme = createContext("/health", "Basic health-secret");
		const valid = createContext("/health", "Bearer health-secret", HealthcheckStatus.DEGRADED);

		await health(missing.context);
		await health(wrong.context);
		await health(wrongScheme.context);
		await health(valid.context);

		expect(missing.response.statusCode).toBe(401);
		expect(wrong.response.statusCode).toBe(401);
		expect(wrongScheme.response.statusCode).toBe(401);
		expect(valid.response.statusCode).toBe(200);
		expect(JSON.parse(valid.response.body)).toMatchObject({
			service: "docportal",
			version: "1.0.0",
			status: "degraded",
			durationMs: 2,
		});
	});

	test("detailed health stays closed when the server token is absent", async () => {
		const { context, response } = createContext(
			"/health",
			"Bearer health-secret",
			HealthcheckStatus.HEALTHY,
			true,
			false,
		);

		await health(context);

		expect(response.statusCode).toBe(503);
		expect(JSON.parse(response.body)).toEqual({ status: "unavailable" });
	});

	test("readiness returns unhealthy when the registry is unavailable", async () => {
		const { context, response } = createContext("/health/readiness", undefined, HealthcheckStatus.HEALTHY, false);

		await health(context);

		expect(response.statusCode).toBe(503);
		expect(JSON.parse(response.body)).toEqual({ status: "unhealthy" });
	});
});
