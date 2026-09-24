import { isSecretKey, REDACTED } from "@ext/loggers/redactSecrets";
import type * as api from "@opentelemetry/api";
import type * as sdk from "@opentelemetry/sdk-trace-base";

export interface ToSpan {
	toSpan(): unknown;
}

/** Approximate budget, in serialized characters, a single span attribute may spend. */
const SERIALIZE_LIMIT = 2600;
const TRUNCATED = "<truncated>";

export enum SpanAttribute {
	Args = "args",
	Result = "res",
	Level = "level",
}

/**
 * Verbosity levels, ascending. A chosen minimum level shows itself and everything LESS verbose.
 * Commands (quietest, default) — command executions, init, high-level actions and failure signals;
 * Important — significant supplementary logs inside commands and lifecycle signals, above internal detail;
 * Internal — state-changing internal work (git, catalog, file structure, resources) and its key reads;
 * Files — plus write operations of FileProvider implementations;
 * Full (firehose) — plus all reads and hot paths.
 * Warn/Error are not levels — errors are carried by span status + recordException.
 * Off is a threshold-only value ("logging disabled", the `logging.level` setting) — never tag a span with it.
 */
export enum Level {
	Off = "off",
	Commands = "commands",
	Important = "important",
	Internal = "internal",
	Files = "files",
	Full = "full",
}

const LEVEL_RANK: Record<Level, number> = {
	[Level.Off]: -1,
	[Level.Commands]: 0,
	[Level.Important]: 1,
	[Level.Internal]: 2,
	[Level.Files]: 3,
	[Level.Full]: 4,
};

export const levelRank = (level: Level): number => LEVEL_RANK[level];

/** True when `level` should be captured given the active `threshold` (min level). */
export const isLevelEnabled = (level: Level, threshold: Level): boolean => levelRank(level) <= levelRank(threshold);

export type Span = {
	name: string;
	spanId: string;
	traceId: string;
	error?: string;
	args?: unknown;
	result?: unknown;
	attrs?: api.Attributes | unknown;
	events?: sdk.TimedEvent[];
	parentSpanId?: string;
	duration: number;
	timestamp: number;
};

export class OtelSpanEncoder {
	fromReadableSpan(span: sdk.ReadableSpan): Span {
		const duration = span.duration[0] * 1000 + span.duration[1] / 1000000; // convert from [sec, nsec] to ms
		const hasError = span.status.code === 2;
		const parent = span.parentSpanContext;
		const events = span.events;

		const attrs = span.attributes;
		Object.entries(attrs).forEach(([key, value]) => {
			attrs[key] = otelSpanEncoder.deserialize(value);
		});

		return {
			name: span.name,
			spanId: span.spanContext().spanId,
			traceId: span.spanContext().traceId,
			parentSpanId: parent ? parent.spanId : undefined,
			attrs,
			events,
			error: hasError ? span.status.message : undefined,
			duration: duration,
			timestamp: span.startTime[0],
		};
	}

	deserialize<T = unknown>(value: api.AttributeValue): T {
		try {
			if (typeof value === "string") return JSON.parse(value);
			return value as T;
		} catch {
			return value as T;
		}
	}

	serialize(value: unknown): api.AttributeValue {
		try {
			if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
			if (typeof value === "function") return "function";

			return JSON.stringify(this._resolveDeep(value));
		} catch (e) {
			// never echo `value` — the object that failed to serialize may be the one carrying credentials
			console.error("failed to serialize span", e);
			return "<unserializable>";
		}
	}

	/**
	 * @param redacted the value sits under a credential-bearing key — every primitive below it is masked.
	 */
	private _resolveDeep(
		value: unknown,
		depth = 0,
		limit = 12,
		seen: WeakSet<object> = new WeakSet(),
		budget: { left: number } = { left: SERIALIZE_LIMIT },
		redacted = false,
	): unknown {
		if (value === null || value === undefined) return value;
		if (typeof value === "string") {
			if (redacted) {
				budget.left -= REDACTED.length + 2;
				return REDACTED;
			}
			const room = Math.max(0, budget.left);
			budget.left -= value.length + 2;
			return value.length > room ? `${value.slice(0, room)}${TRUNCATED}` : value;
		}
		if (typeof value !== "object") {
			budget.left -= redacted ? REDACTED.length + 2 : 8;
			return redacted ? REDACTED : value;
		}

		// binary payloads (image paste, resource content) expand byte-per-key into millions of properties — stub them
		if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return `<binary ${value.byteLength} bytes>`;

		if (seen.has(value)) return "<circular>";

		if ("then" in value && typeof value.then === "function") return "<promise>";
		if ("toSpan" in value && typeof value.toSpan === "function") {
			const span = value.toSpan();
			if (typeof span === "object" && span !== null) {
				if (!Array.isArray(span) && value.constructor) span.constructor = value.constructor.name;
				return this._withPath(seen, value, () =>
					this._resolveDeep(span, depth + 1, limit, seen, budget, redacted),
				);
			}
			return redacted ? REDACTED : span;
		}

		if (depth >= limit) {
			const name = value.constructor?.name;
			return name && name !== "Object" && name !== "Array" ? `<object ${name}>` : "[...]";
		}

		if (Array.isArray(value)) {
			return this._withPath(seen, value, () => {
				const out: unknown[] = [];
				for (const v of value) {
					if (budget.left <= 0) {
						out.push(TRUNCATED);
						break;
					}
					budget.left -= 1;
					out.push(this._resolveDeep(v, depth + 1, limit, seen, budget, redacted));
				}
				return out;
			});
		}

		return this._withPath(seen, value, () => {
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(value)) {
				if (budget.left <= 0) {
					out[TRUNCATED] = TRUNCATED;
					break;
				}
				budget.left -= k.length + 4;
				out[k] = this._resolveDeep(v, depth + 1, limit, seen, budget, redacted || isSecretKey(k));
			}
			return out;
		});
	}

	/**
	 * Marks `value` as being on the current path while its children are walked, then unmarks it.
	 * Only ancestors count as circular — a node reached twice through different branches is walked
	 * twice, so a shared object under a secret key is masked there even if it is also reachable
	 * from a plain key.
	 */
	private _withPath<T>(seen: WeakSet<object>, value: object, walk: () => T): T {
		seen.add(value);
		try {
			return walk();
		} finally {
			seen.delete(value);
		}
	}
}

export const otelSpanEncoder = new OtelSpanEncoder();
