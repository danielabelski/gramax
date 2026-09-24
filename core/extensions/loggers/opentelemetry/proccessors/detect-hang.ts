import type * as api from "@opentelemetry/api";
import { SpanStatusCode } from "@opentelemetry/api";
import type * as sdk from "@opentelemetry/sdk-trace-base";
import { Level, SpanAttribute } from "../span";

type Watch = {
	timer: ReturnType<typeof setTimeout>;
	/** Where the operation was started, taken there rather than in the timer that fires later. */
	stack: string;
	startedAt: number;
	/** When something last happened underneath — a child starting counts as progress. */
	lastProgressAt: number;
	warned: boolean;
};

/**
 * Writes down an operation that stops making progress, so a hang leaves a trace instead of silence.
 *
 * A span reaches the log when it ends, which means an operation that never returns is never written:
 * the log simply stops mentioning it, and what was in flight has to be guessed from what came before.
 * This watches every open span and, when nothing has happened under it for a while, adds an event to
 * it — and later ends it outright, so the record exists even if the operation never comes back.
 *
 * Progress is a child span starting. A long operation that keeps doing things is not hanging, and its
 * clock is pushed forward every time; one that goes quiet is reported after `warnTimeout` of quiet,
 * whether or not it did anything earlier. That last part is the difference between this and a check
 * for childless spans: the span that hung in the sync we chased had 3205 children and then went
 * silent for three minutes.
 */
export default class DetectHangSpanProcessor implements sdk.SpanProcessor {
	private _watched: Map<string, Watch> = new Map();

	constructor(
		private _inner: sdk.SpanProcessor[],
		private _warnTimeout: number,
		private _forceEndTimeout: number,
	) {}

	onStart(span: sdk.Span, parentContext: api.Context): void {
		const parentId = span.parentSpanContext?.spanId;
		if (parentId) this._noteProgress(parentId);

		const now = Date.now();
		this._watched.set(span.spanContext().spanId, {
			lastProgressAt: now,
			stack: new Error().stack ?? "",
			startedAt: now,
			timer: this._armWarning(span),
			warned: false,
		});

		this._inner.forEach((processor) => processor.onStart(span, parentContext));
	}

	onEnding(span: sdk.Span): void {
		this._inner.forEach((processor) => processor.onEnding?.(span));
	}

	onEnd(span: sdk.ReadableSpan): void {
		this._forget(span.spanContext().spanId);
		this._inner.forEach((processor) => processor.onEnd(span));
	}

	async forceFlush(): Promise<void> {
		await this._inner.forEachAsync((processor) => processor.forceFlush());
	}

	async shutdown() {
		this._watched.forEach((watch) => clearTimeout(watch.timer));
		this._watched.clear();

		await this._inner.forEachAsync((processor) => processor.shutdown());
	}

	/**
	 * A child started, so whatever the parent is doing, it is still doing it.
	 *
	 * The clock is pushed forward rather than stopped. Stopping it is how this used to work, and it
	 * meant a span that ever had one child was never watched again — exactly the spans worth watching,
	 * since an operation big enough to hang is an operation big enough to have parts.
	 */
	private _noteProgress(spanId: string): void {
		const watch = this._watched.get(spanId);
		if (!watch || watch.warned) return;

		watch.lastProgressAt = Date.now();
	}

	/** Whether anything is being watched — the tests read it, nothing else should. */
	get watching(): number {
		return this._watched.size;
	}

	private _armWarning(span: sdk.Span): ReturnType<typeof setTimeout> {
		return setTimeout(() => this._onQuiet(span), this._warnTimeout);
	}

	private _onQuiet(span: sdk.Span): void {
		const watch = this._watched.get(span.spanContext().spanId);
		if (!watch) return;

		// Something happened while the timer ran, so the quiet started later than the timer assumed.
		const quietFor = Date.now() - watch.lastProgressAt;
		if (quietFor < this._warnTimeout) {
			watch.timer = setTimeout(() => this._onQuiet(span), this._warnTimeout - quietFor);
			return;
		}

		watch.warned = true;
		span.addEvent("long-running operation detected", {
			[SpanAttribute.Level]: Level.Commands,
			quietForMs: quietFor,
			runningForMs: Date.now() - watch.startedAt,
			startedAt: watch.stack,
		});

		watch.timer = setTimeout(() => this._giveUpOn(span, watch), this._forceEndTimeout - this._warnTimeout);
	}

	/**
	 * Ends a span that never came back, so the log holds it as a failure rather than not at all.
	 *
	 * If the operation does return later, the SDK ignores the second end and the record keeps the
	 * duration up to here — which is a floor on how long it took, and enough to point at it.
	 */
	private _giveUpOn(span: sdk.Span, watch: Watch): void {
		span.addEvent("hung operation detected", {
			[SpanAttribute.Level]: Level.Commands,
			quietForMs: Date.now() - watch.lastProgressAt,
			runningForMs: Date.now() - watch.startedAt,
			startedAt: watch.stack,
		});
		span.setStatus({ code: SpanStatusCode.ERROR, message: "operation did not finish" });
		span.end();
	}

	private _forget(spanId: string): void {
		const watch = this._watched.get(spanId);
		if (!watch) return;

		clearTimeout(watch.timer);
		this._watched.delete(spanId);
	}
}
