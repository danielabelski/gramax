import { env, getExecutingEnvironment } from "@app/resolveModule/env";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import type * as sdk from "@opentelemetry/sdk-trace-base";
import assert from "assert";
import { Level } from "../span";

/** SSR has no settings UI — the min level comes from `GRAMAX_LOG_LEVEL` (off|commands|important|internal|files|full), default `important`. */
const envLogLevel = (): Level => {
	const raw = env("GRAMAX_LOG_LEVEL")?.toLowerCase();
	return Object.values(Level).includes(raw as Level) ? (raw as Level) : Level.Important;
};

/**
 * Push the min level to the native backend so its `EnvFilter` matches the JS-side one — the Node
 * counterpart of the Tauri `set_otel_level` invoke and the wasm worker's `set-otel-level` message.
 * Only `next` has the napi module (`cli` runs on a pure-JS backend); a missing binary is not fatal —
 * the JS-side filter still applies, Rust spans just stay at their `RUST_LOG` level.
 */
const pushLevelToNative = async (level: Level): Promise<void> => {
	if (getExecutingEnvironment() !== "next") return;
	try {
		const { setOtelLevel } = await import("@app/resolveModule/rustcall/next");
		setOtelLevel(level);
	} catch (error) {
		console.warn("otel: native log level not applied", error);
	}
};

/** How long a span may go without anything happening under it before the log says so. */
const WARN_AFTER = 20_000;

/** And how long before it is written off as never coming back. */
const GIVE_UP_AFTER = 125_000;

const registerNext = async (): Promise<void> => {
	const [{ trace: traceNext, context }, { BasicTracerProvider, SimpleSpanProcessor }] = await Promise.all([
		import("@opentelemetry/api"),
		import("@opentelemetry/sdk-trace-base"),
	]);

	globalThis.otel.traceApi = traceNext;
	const asyncHooks = new AsyncLocalStorageContextManager();
	asyncHooks.enable();
	context.setGlobalContextManager(asyncHooks);

	const exporter: sdk.SpanExporter = new (await import("../exporters/stderr-json")).StderrJsonExporter();
	const DetectHangSpanProcessor = (await import("../proccessors/detect-hang")).default;

	// The server had no hang detection at all, so an operation that never returned left nothing in the
	// log — the file just stopped mentioning it. Same budget as the browser: a quiet span is reported
	// after 20 s and written off after 125 s.
	const provider = new BasicTracerProvider({
		spanProcessors: [new DetectHangSpanProcessor([new SimpleSpanProcessor(exporter)], WARN_AFTER, GIVE_UP_AFTER)],
	});
	traceNext.setGlobalTracerProvider(provider);
	globalThis.otel.tracerApi = provider.getTracer("app", env("GRAMAX_VERSION"));
	globalThis.otel.logLevel = envLogLevel();
	await pushLevelToNative(globalThis.otel.logLevel);
};

export const registerOtel = async (): Promise<void> => {
	globalThis.otel = {};
	assert(!globalThis.otel.registered, "can not register otel twice");
	await registerNext();
	globalThis.otel.registered = true;
};
