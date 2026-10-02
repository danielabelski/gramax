import { useAgentSecretDraftStore } from "@ext/agent/components/store/AgentSecretDraftStore";
import t, { pluralize } from "@ext/localization/locale/translate";
import { fireEvent, render } from "@testing-library/react";
import { webcrypto } from "crypto";
import { createElement } from "react";
import { MissingSecretWarning } from "./MissingSecretWarning";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

const mockOpenAgentSecretsSettings = jest.fn();
jest.mock("@ext/agent/components/utils/openAgentSecretsSettings", () => ({
	openAgentSecretsSettings: () => mockOpenAgentSecretsSettings(),
}));

/** Mirrors MissingSecretWarning's own title formula so assertions stay locale-agnostic. */
const nounPhrase = (kind: "token" | "login", names: string[]) =>
	names.length
		? `${pluralize(
				names.length,
				{
					one: t(`agent.missing-secret.noun-${kind}.one`),
					few: t(`agent.missing-secret.noun-${kind}.few`),
					many: t(`agent.missing-secret.noun-${kind}.many`),
				},
				false,
			)} ${names.join(", ")}`
		: null;

const expectedTitleText = (tokenNames: string[], loginNames: string[]) =>
	[
		pluralize(
			tokenNames.length + loginNames.length,
			{
				one: t("agent.missing-secret.verb.one"),
				few: t("agent.missing-secret.verb.few"),
				many: t("agent.missing-secret.verb.many"),
			},
			false,
		),
		[nounPhrase("token", tokenNames), nounPhrase("login", loginNames)]
			.filter(Boolean)
			.join(` ${t("agent.missing-secret.and")} `),
	].join(" ");

describe("MissingSecretWarning", () => {
	beforeEach(() => {
		mockOpenAgentSecretsSettings.mockClear();
		useAgentSecretDraftStore.getState().consumePendingDrafts();
	});

	test("names a single missing token in the title, rendered as a code chip", () => {
		const { getByRole, getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["Ютрек.token"] } }),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText(["Ютрек"], []));
		expect(getByText("Ютрек").tagName).toBe("CODE");
		expect(getByText(t("agent.missing-secret.description-one"), { exact: false })).toBeTruthy();
		expect(getByRole("button", { name: t("agent.missing-secret.button") })).toBeTruthy();
	});

	test("names a single missing login in the title, rendered as a code chip", () => {
		const { getByRole, getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["GitHub.login"] } }),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText([], ["GitHub"]));
		expect(getByText("GitHub").tagName).toBe("CODE");
		expect(getByText(t("agent.missing-secret.description-one"), { exact: false })).toBeTruthy();
		expect(getByRole("button", { name: t("agent.missing-secret.button") })).toBeTruthy();
	});

	test("uses login wording in the title for a *.password secret too", () => {
		const { getByRole } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["GitHub.password"] } }),
		);
		expect(getByRole("heading").textContent).toBe(expectedTitleText([], ["GitHub"]));
	});

	test("uses the singular title and description when *.login and *.password belong to the same credential", () => {
		const { getByRole, getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["GitHub.login", "GitHub.password"] } }),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText([], ["GitHub"]));
		expect(getByText(t("agent.missing-secret.description-one"), { exact: false })).toBeTruthy();
	});

	test("pluralizes the noun and renders every name as its own code chip when several tokens of the same kind are missing", () => {
		const { getByRole, getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["Ютрек.token", "Notion.token"] } }),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText(["Ютрек", "Notion"], []));
		expect(getByRole("heading").querySelectorAll("code")).toHaveLength(2);
		expect(getByText(t("agent.missing-secret.description-many"), { exact: false })).toBeTruthy();
	});

	test("names both kinds when a single token and a single login are missing", () => {
		const { getByRole, getByText } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["Яндекс.token", "Вконтакте.login"] } }),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText(["Яндекс"], ["Вконтакте"]));
		expect(getByText(t("agent.missing-secret.description-many"), { exact: false })).toBeTruthy();
	});

	test("pluralizes only the token noun when several tokens and one login are missing", () => {
		const { getByRole } = render(
			createElement(MissingSecretWarning, {
				warning: { secrets: ["Яндекс.token", "Ютрек.token", "Вконтакте.login"] },
			}),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText(["Яндекс", "Ютрек"], ["Вконтакте"]));
	});

	test("pluralizes only the login noun when one token and several logins are missing", () => {
		const { getByRole } = render(
			createElement(MissingSecretWarning, {
				warning: { secrets: ["Яндекс.token", "Вконтакте.login", "Ютрек.login"] },
			}),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText(["Яндекс"], ["Вконтакте", "Ютрек"]));
	});

	test("clicking 'Добавить' sets a pending draft for every distinct secret and opens settings", () => {
		const { getByRole } = render(
			createElement(MissingSecretWarning, { warning: { secrets: ["Ютрек.token", "GitHub.login"] } }),
		);

		fireEvent.click(getByRole("button", { name: t("agent.missing-secret.button") }));

		expect(useAgentSecretDraftStore.getState().pendingDrafts).toMatchObject([
			{ key: "Ютрек", kind: "token", focus: "value" },
			{ key: "GitHub", kind: "login", focus: "login" },
		]);
		expect(mockOpenAgentSecretsSettings).toHaveBeenCalledTimes(1);
	});

	test("prefers the login field over url when deduping a key with both missing", () => {
		const { getByRole } = render(
			createElement(MissingSecretWarning, {
				warning: { secrets: ["Mail.url", "Mail.login", "Mail.password"] },
			}),
		);

		expect(getByRole("heading").textContent).toBe(expectedTitleText([], ["Mail"]));
		fireEvent.click(getByRole("button", { name: t("agent.missing-secret.button") }));

		expect(useAgentSecretDraftStore.getState().pendingDrafts).toMatchObject([
			{ key: "Mail", kind: "login", focus: "login" },
		]);
	});

	test("falls back to the url field when it's the only thing missing for a key", () => {
		const { getByRole } = render(createElement(MissingSecretWarning, { warning: { secrets: ["Mail.url"] } }));

		expect(getByRole("heading").textContent).toBe(expectedTitleText(["Mail"], []));
		fireEvent.click(getByRole("button", { name: t("agent.missing-secret.button") }));

		expect(useAgentSecretDraftStore.getState().pendingDrafts).toMatchObject([
			{ key: "Mail", kind: "token", focus: "url" },
		]);
	});
});
