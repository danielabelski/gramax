import { webcrypto } from "crypto";
import { useAgentSecretDraftStore } from "./AgentSecretDraftStore";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

describe("useAgentSecretDraftStore", () => {
	beforeEach(() => {
		useAgentSecretDraftStore.getState().consumePendingDrafts();
	});

	test("setPendingDrafts stores the drafts and assigns each a fresh requestId", () => {
		useAgentSecretDraftStore.getState().setPendingDrafts([{ key: "Ютрек", kind: "token", focus: "value" }]);

		const drafts = useAgentSecretDraftStore.getState().pendingDrafts;
		expect(drafts).toMatchObject([{ key: "Ютрек", kind: "token", focus: "value" }]);
		expect(typeof drafts[0]?.requestId).toBe("string");
		expect(drafts[0]?.requestId.length).toBeGreaterThan(0);
	});

	test("each draft in a batch gets a different requestId", () => {
		useAgentSecretDraftStore.getState().setPendingDrafts([
			{ key: "A", kind: "token" },
			{ key: "B", kind: "login", focus: "login" },
		]);

		const [first, second] = useAgentSecretDraftStore.getState().pendingDrafts;
		expect(first?.requestId).not.toBe(second?.requestId);
	});

	test("a later setPendingDrafts call gets a different requestId than an earlier one", () => {
		useAgentSecretDraftStore.getState().setPendingDrafts([{ key: "A", kind: "token" }]);
		const firstId = useAgentSecretDraftStore.getState().pendingDrafts[0]?.requestId;

		useAgentSecretDraftStore.getState().setPendingDrafts([{ key: "B", kind: "login", focus: "login" }]);
		const secondId = useAgentSecretDraftStore.getState().pendingDrafts[0]?.requestId;

		expect(firstId).not.toBe(secondId);
	});

	test("consumePendingDrafts returns the drafts once, then clears them", () => {
		useAgentSecretDraftStore.getState().setPendingDrafts([{ key: "Ютрек", kind: "token", focus: "value" }]);

		const first = useAgentSecretDraftStore.getState().consumePendingDrafts();
		expect(first).toMatchObject([{ key: "Ютрек", kind: "token", focus: "value" }]);

		const second = useAgentSecretDraftStore.getState().consumePendingDrafts();
		expect(second).toEqual([]);
		expect(useAgentSecretDraftStore.getState().pendingDrafts).toEqual([]);
	});

	test("consumePendingDrafts returns an empty array when there is nothing pending", () => {
		expect(useAgentSecretDraftStore.getState().consumePendingDrafts()).toEqual([]);
	});

	test("a fresh store has no pending drafts (not persisted across reload)", () => {
		expect(useAgentSecretDraftStore.getState().pendingDrafts).toEqual([]);
	});
});
