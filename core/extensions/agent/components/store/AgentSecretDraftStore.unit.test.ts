import { webcrypto } from "crypto";
import { useAgentSecretDraftStore } from "./AgentSecretDraftStore";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

describe("useAgentSecretDraftStore", () => {
	beforeEach(() => {
		useAgentSecretDraftStore.getState().consumePendingDraft();
	});

	test("setPendingDraft stores the draft and assigns a fresh requestId", () => {
		useAgentSecretDraftStore.getState().setPendingDraft({ key: "Ютрек", kind: "token", focus: "value" });

		const draft = useAgentSecretDraftStore.getState().pendingDraft;
		expect(draft).toMatchObject({ key: "Ютрек", kind: "token", focus: "value" });
		expect(typeof draft?.requestId).toBe("string");
		expect(draft?.requestId.length).toBeGreaterThan(0);
	});

	test("two drafts get different requestIds", () => {
		useAgentSecretDraftStore.getState().setPendingDraft({ key: "A", kind: "token" });
		const firstId = useAgentSecretDraftStore.getState().pendingDraft?.requestId;

		useAgentSecretDraftStore.getState().setPendingDraft({ key: "B", kind: "login", focus: "login" });
		const secondId = useAgentSecretDraftStore.getState().pendingDraft?.requestId;

		expect(firstId).not.toBe(secondId);
	});

	test("consumePendingDraft returns the draft once, then clears it", () => {
		useAgentSecretDraftStore.getState().setPendingDraft({ key: "Ютрек", kind: "token", focus: "value" });

		const first = useAgentSecretDraftStore.getState().consumePendingDraft();
		expect(first).toMatchObject({ key: "Ютрек", kind: "token", focus: "value" });

		const second = useAgentSecretDraftStore.getState().consumePendingDraft();
		expect(second).toBeNull();
		expect(useAgentSecretDraftStore.getState().pendingDraft).toBeNull();
	});

	test("consumePendingDraft returns null when there is no pending draft", () => {
		expect(useAgentSecretDraftStore.getState().consumePendingDraft()).toBeNull();
	});

	test("a fresh store has no pending draft (not persisted across reload)", () => {
		expect(useAgentSecretDraftStore.getState().pendingDraft).toBeNull();
	});
});
