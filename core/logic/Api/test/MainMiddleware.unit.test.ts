/**
 * @jest-environment node
 */

import type { CommandTree } from "@app/commands";
import type Application from "@app/types/Application";
import type ApiRequest from "@core/Api/ApiRequest";
import type ApiResponse from "@core/Api/ApiResponse";
import { CLIENT_CLOSED_STATUS_CODE } from "@core/Api/consts";
import { MainMiddleware } from "@core/Api/middleware/MainMiddleware";
import type Middleware from "@core/Api/middleware/Middleware";

describe("MainMiddleware", () => {
	const makeMiddleware = (thrown: Error) => {
		const logged: Error[] = [];
		const app = {
			conf: {},
			logger: { logError: (error: Error) => logged.push(error) },
		} as unknown as Application;

		const middleware = new MainMiddleware("test/command")
			.init({ app, commands: {} as CommandTree })
			.SetNext({ Process: () => Promise.reject(thrown) } as unknown as Middleware);

		return { middleware, logged };
	};

	const makeRes = () => {
		const res = {
			statusCode: 0,
			headers: {},
			setHeader: () => {},
			send: () => {},
			end: () => {},
		} as unknown as ApiResponse;
		return res;
	};

	const abortError = () => Object.assign(new Error("aborted"), { name: "AbortError" });

	test("responds 499 when the client aborted the request", async () => {
		const { middleware, logged } = makeMiddleware(abortError());
		const controller = new AbortController();
		controller.abort();
		const req = { headers: {}, query: {}, body: {}, clientAbortSignal: controller.signal } as ApiRequest;
		const res = makeRes();

		await middleware.Process(req, res);

		expect(res.statusCode).toBe(CLIENT_CLOSED_STATUS_CODE);
		expect(logged).toHaveLength(0);
	});

	test("AbortError with a live client is a regular error, not 499", async () => {
		const { middleware, logged } = makeMiddleware(abortError());
		const req = { headers: {}, query: {}, body: {}, clientAbortSignal: new AbortController().signal } as ApiRequest;
		const res = makeRes();

		await middleware.Process(req, res);

		expect(res.statusCode).toBe(500);
		expect(logged).toHaveLength(1);
	});

	test("AbortError on a route without a client signal is a regular error", async () => {
		const { middleware, logged } = makeMiddleware(abortError());
		const req = { headers: {}, query: {}, body: {} } as ApiRequest;
		const res = makeRes();

		await middleware.Process(req, res);

		expect(res.statusCode).toBe(500);
		expect(logged).toHaveLength(1);
	});
});
