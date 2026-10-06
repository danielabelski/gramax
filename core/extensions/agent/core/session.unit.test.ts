import { AgentErrorType } from "./agentError";
import type { AgentEvent } from "./events";
import { AgentSession } from "./session";

function createSession(events: AgentEvent[] = []): AgentSession {
	const session = new AgentSession("session-1", "");
	session.events = events;
	return session;
}

describe("AgentSession.updateUsage", () => {
	test("accumulates session tokens and tracks last prompt context usage", () => {
		const session = createSession();

		session.updateUsage(100, 150, 40, 60, 10_000);
		session.updateUsage(200, 250, 10, 20, 10_000);

		expect(session.usage).toMatchObject({
			totalUsage: 400,
			lastTurnUsage: 400,
			cacheHitTokens: 50,
			cacheMissTokens: 80,
			contextTokensUsed: 200,
			contextWindowTokens: 10_000,
			contextUsagePercent: 2,
		});
	});

	test("caps contextUsagePercent at 100", () => {
		const session = createSession();
		session.updateUsage(5000, 100, 0, 0, 1000);
		expect(session.usage.contextUsagePercent).toBe(100);
	});

	test("does not change contextUsagePercent without prompt tokens or window size", () => {
		const session = createSession();
		session.usage.contextUsagePercent = 42;

		session.updateUsage(0, 100, 0, 0, 10_000);
		expect(session.usage.contextUsagePercent).toBe(42);

		session.updateUsage(500, 100, 0, 0, 0);
		expect(session.usage.contextUsagePercent).toBe(42);
	});
});

describe("AgentSession.lastAssistantReply", () => {
	test("returns empty when there is no assistant_message", () => {
		expect(createSession().lastAssistantReply()).toBe("");
		expect(
			createSession([
				{ type: "user_message", turnId: "turn-1", ts: 1, content: "hi" },
				{ type: "assistant_delta", turnId: "turn-1", ts: 2, content: "streaming" },
			]).lastAssistantReply(),
		).toBe("");
	});

	test("returns last assistant_message, ignoring deltas and errors", () => {
		const session = createSession([
			{ type: "user_message", turnId: "turn-1", ts: 1, content: "hi" },
			{ type: "assistant_message", turnId: "turn-1", ts: 2, content: "first", contentPreview: "first" },
			{ type: "assistant_delta", turnId: "turn-2", ts: 3, content: "partial" },
			{ type: "error", turnId: "turn-2", ts: 4, message: "fail", errorType: AgentErrorType.Unexpected },
			{ type: "assistant_message", turnId: "turn-2", ts: 5, content: "second", contentPreview: "second" },
		]);

		expect(session.lastAssistantReply()).toBe("second");
	});
});

describe("AgentSession.closeInterruptedTurn", () => {
	test("closes a processing turn without a live run", () => {
		const session = createSession([{ type: "user_message", turnId: "turn-1", ts: 1, content: "hi" }]);
		session.processing = true;

		expect(session.closeInterruptedTurn()).toBe(true);
		expect(session.processing).toBe(false);
		expect(session.events.at(-1)).toMatchObject({
			type: "turn_finished",
			turnId: "turn-1",
			status: "cancelled",
		});
	});

	test("does nothing when the session is idle", () => {
		const events: AgentEvent[] = [{ type: "user_message", turnId: "turn-1", ts: 1, content: "hi" }];
		const session = createSession(events);

		expect(session.closeInterruptedTurn()).toBe(false);
		expect(session.events).toEqual(events);
	});

	test("does not add a second turn_finished", () => {
		const session = createSession([
			{ type: "user_message", turnId: "turn-1", ts: 1, content: "hi" },
			{ type: "turn_finished", turnId: "turn-1", ts: 2, status: "completed" },
		]);
		session.processing = true;

		expect(session.closeInterruptedTurn()).toBe(true);
		expect(session.events.filter((e) => e.type === "turn_finished")).toHaveLength(1);
	});
});

describe("AgentSession.fromSnapshot", () => {
	test("restores the snapshot as stored, without closing an interrupted turn", () => {
		const snapshot = createSession([{ type: "user_message", turnId: "turn-1", ts: 1, content: "hi" }]).toSnapshot();
		snapshot.processing = true;

		const restored = AgentSession.fromSnapshot(snapshot);

		expect(restored.processing).toBe(true);
		expect(restored.activeRunController).toBeNull();
		expect(restored.events.at(-1)).toMatchObject({ type: "user_message", turnId: "turn-1" });
	});
});
