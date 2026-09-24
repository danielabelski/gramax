import { useAgentSecretDraftStore } from "@ext/agent/components/store/AgentSecretDraftStore";
import t from "@ext/localization/locale/translate";
import { fireEvent, render } from "@testing-library/react";
import { webcrypto } from "crypto";
import { createElement } from "react";
import { MissingSecretWarning } from "./MissingSecretWarning";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

const mockOpenAgentSecretsSettings = jest.fn();
jest.mock("@ext/agent/components/utils/openAgentSecretsSettings", () => ({
	openAgentSecretsSettings: () => mockOpenAgentSecretsSettings(),
}));

describe("MissingSecretWarning", () => {
	beforeEach(() => {
		mockOpenAgentSecretsSettings.mockClear();
		useAgentSecretDraftStore.getState().consumePendingDraft();
	});

	test("uses token wording in the title for a *.token secret", () => {
		const { getByText, getByRole } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["Ютрек.token"] } }),
		);

		expect(getByText(t("agent.missing-secret.title-token"))).toBeTruthy();
		expect(getByText(t("agent.missing-secret.description-one"), { exact: false })).toBeTruthy();
		expect(getByRole("button", { name: t("agent.missing-secret.button") })).toBeTruthy();
	});

	test("uses login wording in the title for a *.login secret", () => {
		const { getByText, getByRole } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["GitHub.login"] } }),
		);

		expect(getByText(t("agent.missing-secret.title-login"))).toBeTruthy();
		expect(getByRole("button", { name: t("agent.missing-secret.button") })).toBeTruthy();
	});

	test("uses login wording in the title for a *.password secret too", () => {
		const { getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["GitHub.password"] } }),
		);
		expect(getByText(t("agent.missing-secret.title-login"))).toBeTruthy();
	});

	test("uses the singular description when *.login and *.password belong to the same credential", () => {
		const { getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["GitHub.login", "GitHub.password"] } }),
		);

		expect(getByText(t("agent.missing-secret.description-one"), { exact: false })).toBeTruthy();
	});

	test("uses the plural description and the first secret's kind in the title when there are several missing secrets", () => {
		const { getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["Ютрек.token", "GitHub.login"] } }),
		);

		expect(getByText(t("agent.missing-secret.title-token"))).toBeTruthy();
		expect(getByText(t("agent.missing-secret.description-many"), { exact: false })).toBeTruthy();
	});

	test("clicking 'Добавить' sets a pending draft parsed from the first secret and opens settings", () => {
		const { getByRole } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["Ютрек.token", "GitHub.login"] } }),
		);

		fireEvent.click(getByRole("button", { name: t("agent.missing-secret.button") }));

		expect(useAgentSecretDraftStore.getState().pendingDraft).toMatchObject({
			key: "Ютрек",
			kind: "token",
			focus: "value",
		});
		expect(mockOpenAgentSecretsSettings).toHaveBeenCalledTimes(1);
	});

	test("clicking Add for a login secret missing url first still drafts kind login", () => {
		const { getByText, getByRole } = render(
			createElement(MissingSecretWarning, {
				warning: { secrets: ["Mail.url", "Mail.login", "Mail.password"] },
			}),
		);

		expect(getByText(t("agent.missing-secret.title-login"))).toBeTruthy();
		fireEvent.click(getByRole("button", { name: t("agent.missing-secret.button") }));

		expect(useAgentSecretDraftStore.getState().pendingDraft).toMatchObject({
			key: "Mail",
			kind: "login",
			focus: "login",
		});
	});
});
