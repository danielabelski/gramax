import { useAgentSecretDraftStore } from "@ext/agent/components/store/AgentSecretDraftStore";
import { act, renderHook } from "@testing-library/react";
import { webcrypto } from "crypto";
import { useAgentSecrets } from "./useAgentSecrets";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

const mockListCall = jest.fn();
const mockSetCall = jest.fn();
const mockUpdateCall = jest.fn();
const mockDeleteCall = jest.fn();
let mockListStatus: "init" | "loading" | "done" = "loading";

jest.mock("@core-ui/hooks/useApi", () => ({
	RequestStatus: { Init: "init", Loading: "loading", Done: "done", Error: "error" },
	useDeferApi: (props: { url?: (api: Record<string, (...args: string[]) => string>) => string }) => {
		if (!props.url) return { call: mockDeleteCall };
		const endpoint = props.url({
			getAgentSecretsListUrl: () => "list",
			getAgentSecretsSetUrl: () => "set",
			getAgentSecretsUpdateUrl: () => "update",
			getAgentSecretsDeleteUrl: (key: string) => `delete:${key}`,
		});
		if (endpoint === "list") return { call: mockListCall, status: mockListStatus };
		if (endpoint === "set") return { call: mockSetCall };
		if (endpoint === "update") return { call: mockUpdateCall };
		throw new Error(`useAgentSecrets.unit.test: unexpected endpoint "${endpoint}"`);
	},
}));

jest.mock("@ext/agent/components/utils/secret/useAgentSecretNames", () => ({
	addAgentSecretNameToCache: jest.fn(),
	removeAgentSecretNameFromCache: jest.fn(),
	renameAgentSecretNameInCache: jest.fn(),
}));

describe("useAgentSecrets — missing-secret draft consumption", () => {
	beforeEach(() => {
		mockListStatus = "loading";
		useAgentSecretDraftStore.getState().consumePendingDraft();
	});

	test("does not consume a pending draft while the secret list is still loading", async () => {
		useAgentSecretDraftStore.getState().setPendingDraft({ key: "Ютрек", kind: "token", focus: "value" });

		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		expect(result.current.fields).toHaveLength(0);
		expect(useAgentSecretDraftStore.getState().pendingDraft).not.toBeNull();
	});

	test("consumes a pending draft once loading finishes, prepending an unsaved draft row", async () => {
		useAgentSecretDraftStore.getState().setPendingDraft({ key: "Ютрек", kind: "token", focus: "value" });

		const { result, rerender } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		mockListStatus = "done";
		rerender();

		expect(useAgentSecretDraftStore.getState().pendingDraft).toBeNull();
		expect(result.current.fields).toHaveLength(1);
		expect(result.current.secrets[0]).toMatchObject({ key: "Ютрек", kind: "token", savedKey: "", value: "" });
		expect(result.current.focusedDraftField).toBe("value");
		expect(result.current.focusedDraftRowId).toBe(result.current.secrets[0].id);
	});

	test("does not add a duplicate row on further rerenders once a draft has been consumed", async () => {
		useAgentSecretDraftStore.getState().setPendingDraft({ key: "Ютрек", kind: "token", focus: "value" });

		const { result, rerender } = renderHook(() => useAgentSecrets());
		await act(async () => {});
		mockListStatus = "done";
		rerender();
		rerender();
		rerender();

		expect(result.current.fields).toHaveLength(1);
	});

	test("does not remount into a duplicate row: a second hook instance sees the already-cleared draft", async () => {
		useAgentSecretDraftStore.getState().setPendingDraft({ key: "Ютрек", kind: "token", focus: "value" });
		mockListStatus = "done";

		const { result: first } = renderHook(() => useAgentSecrets());
		await act(async () => {});
		expect(first.current.fields).toHaveLength(1);

		const { result: second } = renderHook(() => useAgentSecrets());
		await act(async () => {});
		expect(second.current.fields).toHaveLength(0);
	});

	test("does not create a duplicate row when a secret with the same (normalized) key already exists", async () => {
		const { result, rerender } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.form.reset({
				rows: [
					{
						id: "existing-1",
						key: "Ютрек",
						savedKey: "Ютрек",
						value: "old-token",
						kind: "token",
						login: "",
						url: "",
					},
				],
			});
		});
		useAgentSecretDraftStore.getState().setPendingDraft({ key: " Ютрек ", kind: "token", focus: "value" });
		mockListStatus = "done";
		rerender();

		expect(result.current.fields).toHaveLength(1);
		expect(result.current.secrets[0].id).toBe("existing-1");
		expect(useAgentSecretDraftStore.getState().pendingDraft).toBeNull();
		expect(result.current.focusedDraftRowId).toBe("existing-1");
	});

	test("addDraftSecret() with no arguments still prepends a plain empty row", async () => {
		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.addDraftSecret();
		});

		expect(result.current.fields).toHaveLength(1);
		expect(result.current.secrets[0]).toMatchObject({ key: "", kind: "token", savedKey: "", value: "" });
	});

	test("manually adding a row (the '+' button) focuses the key field", async () => {
		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.addDraftSecret();
		});

		expect(result.current.focusedDraftField).toBe("key");
		expect(result.current.focusedDraftRowId).toBe(result.current.secrets[0].id);
	});
});

describe("useAgentSecrets — save (wired into AgentSecretsSection's unmount safety-net)", () => {
	beforeEach(() => {
		mockListStatus = "loading";
		mockSetCall.mockReset();
	});

	test("does not save an already committed unchanged row", async () => {
		mockSetCall.mockResolvedValue({ ok: true });

		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.form.reset({
				rows: [
					{
						id: "row-1",
						key: "Ютрек",
						savedKey: "Ютрек",
						value: "a",
						kind: "token",
						login: "",
						url: "",
						savedSecret: { type: "token", token: "a" },
					},
				],
			});
		});

		await expect(result.current.save()).resolves.toBeUndefined();
		expect(mockSetCall).not.toHaveBeenCalled();
	});

	test("saves a committed row whose focused value changed before blur", async () => {
		mockSetCall.mockResolvedValue({ ok: true });

		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.form.reset({
				rows: [
					{
						id: "row-1",
						key: "Ютрек",
						savedKey: "Ютрек",
						value: "new",
						kind: "token",
						login: "",
						url: "",
						savedSecret: { type: "token", token: "old" },
					},
				],
			});
		});

		await expect(result.current.save()).resolves.toBeUndefined();
		expect(mockSetCall).toHaveBeenCalledTimes(1);
	});

	test("throws when a row can't be committed (duplicate key)", async () => {
		mockSetCall.mockResolvedValue({ ok: true });

		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.form.reset({
				rows: [
					{ id: "row-1", key: "Ютрек", savedKey: "Ютрек", value: "a", kind: "token", login: "", url: "" },
					{ id: "row-2", key: "Ютрек", savedKey: "", value: "b", kind: "token", login: "", url: "" },
				],
			});
		});

		await expect(result.current.save()).rejects.toThrow();
	});
});

describe("useAgentSecrets — commitSecret (nothing blocks navigation, a bad row just doesn't persist)", () => {
	beforeEach(() => {
		mockListStatus = "loading";
		mockSetCall.mockReset();
		mockUpdateCall.mockReset();
	});

	test("returns false and calls neither set nor update for a row with a login/value but no key", async () => {
		mockSetCall.mockResolvedValue({ ok: true });

		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.form.reset({
				rows: [{ id: "draft-1", key: "", savedKey: "", value: "secret", kind: "token", login: "", url: "" }],
			});
		});

		await expect(result.current.commitSecret(0)).resolves.toBe(false);
		expect(mockSetCall).not.toHaveBeenCalled();
		expect(mockUpdateCall).not.toHaveBeenCalled();
	});

	test("marks the key field itself invalid right after a single commitSecret call, not just on a later interaction", async () => {
		// Regression: commitSecret used to trigger the row as an object path (`rows.${i}`), which
		// react-hook-form validates correctly but doesn't propagate onto the leaf field's own
		// fieldState — so the key input stayed visually valid until some later, unrelated interaction
		// happened to validate it directly. commitSecret must trigger the leaf path (`rows.${i}.key`).
		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.form.reset({
				rows: [{ id: "draft-1", key: "", savedKey: "", value: "secret", kind: "token", login: "", url: "" }],
			});
		});

		await act(async () => {
			await result.current.commitSecret(0);
		});

		expect(result.current.form.getFieldState("rows.0.key", result.current.form.formState).invalid).toBe(true);
	});

	test("returns false and doesn't overwrite the existing value when the key duplicates another row", async () => {
		mockSetCall.mockResolvedValue({ ok: true });

		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.form.reset({
				rows: [
					{ id: "row-1", key: "GitHub", savedKey: "GitHub", value: "old", kind: "token", login: "", url: "" },
					{ id: "row-2", key: "GitHub", savedKey: "", value: "new", kind: "token", login: "", url: "" },
				],
			});
		});

		await expect(result.current.commitSecret(1)).resolves.toBe(false);
		expect(mockSetCall).not.toHaveBeenCalled();
		expect(mockUpdateCall).not.toHaveBeenCalled();
	});

	test("returns true for a blank, untouched draft row — nothing to validate or commit", async () => {
		const { result } = renderHook(() => useAgentSecrets());
		await act(async () => {});

		act(() => {
			result.current.addDraftSecret();
		});

		await expect(result.current.commitSecret(0)).resolves.toBe(true);
		expect(mockSetCall).not.toHaveBeenCalled();
	});
});
