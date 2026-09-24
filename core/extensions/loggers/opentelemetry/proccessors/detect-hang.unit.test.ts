import type * as api from "@opentelemetry/api";
import { SpanStatusCode } from "@opentelemetry/api";
import type * as sdk from "@opentelemetry/sdk-trace-base";
import DetectHangSpanProcessor from "./detect-hang";

/**
 * What an operation that never returns leaves in the log.
 *
 * A span is written when it ends, so a hang writes nothing at all: the log stops mentioning the
 * operation and the reader is left guessing from what came before. These pin the two moments that
 * have to survive that — the report while it is still open, and the record once it is written off.
 */

const WARN = 20_000;
const GIVE_UP = 125_000;

type FakeSpan = sdk.Span & {
	events: { name: string; attrs?: Record<string, unknown> }[];
	status?: { code: SpanStatusCode; message?: string };
	ended: boolean;
};

let nextId = 0;

const span = (parent?: FakeSpan): FakeSpan => {
	const spanId = `span-${++nextId}`;
	const fake = {
		addEvent(name: string, attrs?: Record<string, unknown>) {
			fake.events.push({ attrs, name });
			return fake;
		},
		end() {
			fake.ended = true;
		},
		ended: false,
		events: [],
		parentSpanContext: parent ? { spanId: parent.spanContext().spanId } : undefined,
		setStatus(status: { code: SpanStatusCode; message?: string }) {
			fake.status = status;
			return fake;
		},
		spanContext: () => ({ spanId }),
	} as unknown as FakeSpan;

	return fake;
};

const processor = () => new DetectHangSpanProcessor([], WARN, GIVE_UP);
const eventNames = (s: FakeSpan) => s.events.map((event) => event.name);
const noContext = {} as api.Context;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("a span that stops making progress", () => {
	test("is reported while it is still open, and written off if it never comes back", () => {
		const detector = processor();
		const hanging = span();

		detector.onStart(hanging, noContext);

		jest.advanceTimersByTime(WARN);
		expect(eventNames(hanging)).toEqual(["long-running operation detected"]);
		expect(hanging.ended).toBe(false);

		jest.advanceTimersByTime(GIVE_UP - WARN);
		expect(eventNames(hanging)).toEqual(["long-running operation detected", "hung operation detected"]);
		expect(hanging.ended).toBe(true);
		expect(hanging.status?.code).toBe(SpanStatusCode.ERROR);
	});

	/**
	 * The case this was blind to. A child starting used to cancel the parent's timer outright, so an
	 * operation that ever had one part was never watched again — and an operation big enough to hang is
	 * an operation big enough to have parts. The sync that prompted this had 3205 children and then
	 * three minutes of silence, and nothing was written.
	 */
	test("is reported even when it did plenty of work first", () => {
		const detector = processor();
		const parent = span();

		detector.onStart(parent, noContext);

		for (let i = 0; i < 5; i++) {
			jest.advanceTimersByTime(WARN / 2);
			const child = span(parent);
			detector.onStart(child, noContext);
			detector.onEnd(child as unknown as sdk.ReadableSpan);
		}

		expect(eventNames(parent)).toEqual([]);

		jest.advanceTimersByTime(WARN);

		expect(eventNames(parent)).toEqual(["long-running operation detected"]);
	});

	/**
	 * Both numbers are in the report because they answer different questions: how long the thing has
	 * been going, and how long it has been going *nowhere*. The second is the one that says it hung.
	 */
	test("reports how long the quiet lasted, not how long the operation ran", () => {
		const detector = processor();
		const parent = span();

		detector.onStart(parent, noContext);

		// Half-way to the first report, something happens — so the clock starts again from here.
		jest.advanceTimersByTime(WARN / 2);
		detector.onStart(span(parent), noContext);

		jest.advanceTimersByTime(WARN);

		const [reported] = parent.events;
		expect(reported.attrs?.quietForMs).toBe(WARN);
		expect(reported.attrs?.runningForMs).toBe(WARN * 1.5);
	});
});

describe("a span that is doing its job", () => {
	test("says nothing while its children keep starting", () => {
		const detector = processor();
		const parent = span();

		detector.onStart(parent, noContext);

		for (let i = 0; i < 20; i++) {
			jest.advanceTimersByTime(WARN - 1);
			detector.onStart(span(parent), noContext);
		}

		expect(eventNames(parent)).toEqual([]);
	});

	test("is forgotten when it ends, so a long session does not accumulate watches", () => {
		const detector = processor();
		const first = span();
		const second = span();

		detector.onStart(first, noContext);
		detector.onStart(second, noContext);
		expect(detector.watching).toBe(2);

		detector.onEnd(first as unknown as sdk.ReadableSpan);
		detector.onEnd(second as unknown as sdk.ReadableSpan);

		expect(detector.watching).toBe(0);
	});

	test("says nothing when it finishes in time", () => {
		const detector = processor();
		const quick = span();

		detector.onStart(quick, noContext);
		jest.advanceTimersByTime(WARN - 1);
		detector.onEnd(quick as unknown as sdk.ReadableSpan);

		jest.advanceTimersByTime(GIVE_UP);

		expect(eventNames(quick)).toEqual([]);
		expect(quick.ended).toBe(false);
	});
});
