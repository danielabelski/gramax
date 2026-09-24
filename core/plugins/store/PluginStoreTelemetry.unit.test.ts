import { Level } from "@ext/loggers/opentelemetry";
import { context as apiContext, trace as apiTrace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { PluginConfig } from "@plugins/types";
import { partitionPluginsForLoad } from "./PluginStore";

describe("partitionPluginsForLoad telemetry", () => {
	const contextManager = new AsyncLocalStorageContextManager();
	let exporter: InMemorySpanExporter;

	beforeAll(() => {
		contextManager.enable();
		apiContext.setGlobalContextManager(contextManager);
	});

	afterAll(() => {
		apiContext.disable();
	});

	beforeEach(() => {
		exporter = new InMemorySpanExporter();
		const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
		(globalThis as { otel?: unknown }).otel = {
			traceApi: apiTrace,
			tracerApi: provider.getTracer("test"),
			registered: true,
			logLevel: Level.Commands,
		};
	});

	afterEach(() => {
		delete (globalThis as { otel?: unknown }).otel;
	});

	test("records an incompatible SDK range in application logs", () => {
		const plugin: PluginConfig = {
			metadata: {
				id: "branch-checkout-guard",
				name: "Branch checkout guard",
				version: "0.1.0",
				entryPoint: "index.js",
				disabled: false,
				platform: [],
				engines: { gramaxSdk: ">=0.1.0-alpha.11 <0.1.0-alpha.11" },
			},
			script: "export default class BranchCheckoutGuard {}",
		};

		partitionPluginsForLoad([plugin], "Desktop", "0.1.0-alpha.12");

		const event = exporter
			.getFinishedSpans()
			.flatMap((span) => span.events)
			.find((event) => event.name === "plugin-validation-failed");
		expect(event?.attributes).toMatchObject({
			id: "branch-checkout-guard",
			sdkVersion: "0.1.0-alpha.12",
			requiredRange: ">=0.1.0-alpha.11 <0.1.0-alpha.11",
			reason: "unsupported-sdk",
		});
	});
});
