import { SECRET_NAME_RE } from "@ext/markdown/elements/secret/edit/logic/secretFields";

export type SecretDraft = { key: string; kind: "token" | "login"; focus: "key" | "login" | "value" | "url" };

/** Maps a secret name (`key.field`) to what the keys-and-passwords draft row for it should look like. */
export const parseSecretDraft = (secretName: string): SecretDraft => {
	const match = SECRET_NAME_RE.exec(secretName);
	if (!match) return { key: secretName, kind: "token", focus: "value" };

	const [, key, field] = match;
	if (field === "token") return { key, kind: "token", focus: "value" };
	if (field === "login") return { key, kind: "login", focus: "login" };
	if (field === "url") return { key, kind: "token", focus: "url" };
	return { key, kind: "login", focus: "value" }; // "password"
};
