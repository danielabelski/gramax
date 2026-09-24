import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import t from "@ext/localization/locale/translate";
import { z } from "zod";

/** Trims surrounding whitespace only — a secret name has no other restrictions, spaces and punctuation included. */
export const normalizeSecretKey = (key: string): string => key.trim();

const secretKindSchema = z.enum(["token", "login"]);

const isBlankSecretRow = (row: { key?: string; login?: string; value?: string; url?: string }): boolean =>
	!normalizeSecretKey(row.key ?? "") && !(row.login ?? "").trim() && !row.value && !(row.url ?? "").trim();

/** `login`/`kind` are UI-only — the backend only ever stores a flat `key -> value` map. A blank
 *  draft row is valid so "+" can prepend one; a filled-in row still needs a non-empty key. */
const secretRowSchema = z.object({
	id: z.string(),
	key: z.string(),
	savedKey: z.string(),
	savedSecret: z.custom<AgentSecret>().optional(),
	value: z.string(),
	kind: secretKindSchema,
	login: z.string(),
	url: z.string(),
});

export const agentSecretsFormSchema = z.object({
	rows: z.array(secretRowSchema).superRefine((rows, ctx) => {
		const indicesByKey = new Map<string, number[]>();
		rows.forEach((row, index) => {
			if (isBlankSecretRow(row)) return;
			const key = normalizeSecretKey(row.key);
			if (!key) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: t("app-settings.keys-passwords.key-required"),
					path: [index, "key"],
				});
				return;
			}
			indicesByKey.set(key, [...(indicesByKey.get(key) ?? []), index]);
		});
		for (const indices of indicesByKey.values()) {
			if (indices.length < 2) continue;
			for (const index of indices) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: t("app-settings.keys-passwords.key-duplicate"),
					path: [index, "key"],
				});
			}
		}
	}),
});

export type SecretKind = z.infer<typeof secretKindSchema>;
export type AgentSecretsFormData = z.infer<typeof agentSecretsFormSchema>;
export type SecretRow = AgentSecretsFormData["rows"][number];
