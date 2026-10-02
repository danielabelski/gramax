import { useAgentSecretDraftStore } from "@ext/agent/components/store/AgentSecretDraftStore";
import { openAgentSecretsSettings } from "@ext/agent/components/utils/openAgentSecretsSettings";
import { parseSecretDraft, type SecretDraft } from "@ext/agent/components/utils/secret/secretDraft";
import t, { pluralize } from "@ext/localization/locale/translate";
import { type ReactNode, useMemo } from "react";

type MissingSecretPhrase = { kind: "token" | "login"; noun: string; names: string[] };

// Same look as an article's inline code span (`.article code` in article.css: background
// var(--color-code-bg), radius var(--radius-small), 2px padding) — reusing those tokens directly
// instead of `.article`-scoped classes keeps the chip visually consistent without depending on an
// `.article` ancestor, and without dragging in the markdown Code component's copy-to-clipboard
// behavior, which doesn't apply to a name that's only ever read here. `<code>` itself already gets a
// monospace font app-wide from the unscoped `code, kbd, pre, samp` rule in article.css.
const SecretName = ({ children }: { children: string }) => (
	<code className="rounded-[var(--radius-small)] bg-[var(--color-code-bg)] p-0.5 text-sm">{children}</code>
);

const phraseFor = (kind: "token" | "login", names: string[]): MissingSecretPhrase[] =>
	names.length
		? [
				{
					kind,
					noun: pluralize(
						names.length,
						{
							one: t(`agent.missing-secret.noun-${kind}.one`),
							few: t(`agent.missing-secret.noun-${kind}.few`),
							many: t(`agent.missing-secret.noun-${kind}.many`),
						},
						false,
					),
					names,
				},
			]
		: [];

/**
 * Groups a missing-secret warning's raw secret names (`Key.token` / `Key.login` / `Key.password`)
 * into a title that names every missing credential (each as its own SecretName code chip) with
 * wording that agrees in number with how many names each kind has — "Missing token X" vs "Missing
 * tokens X, Y" — plus the matching description and the "add to settings" click handler, so
 * MissingSecretWarning only has to render what this hook returns.
 */
export const useMissingSecretWarning = (secrets: string[]) => {
	// `secrets` gets a new array reference on most re-renders while this card streams in chat (the
	// parent's own memo is keyed on the whole response list), even though the actual set of missing
	// secret names is usually unchanged — key on content, not reference, so a same-content re-render
	// skips reparsing every secret name.
	const secretsKey = secrets.join("|");
	// A login secret spans two var names (`Key.login` + `Key.password`) — a given key never mixes
	// kinds (the backend stores one `AgentSecret` per key, either a token or a login), so deduping by
	// key alone is enough to keep one draft per distinct credential and group it under the right kind.
	// `url` is on both kinds, so it can't decide kind/focus on its own — if another field of the same
	// key is also missing, that field wins the slot; `url` only represents its key when nothing else does.
	// biome-ignore lint/correctness/useExhaustiveDependencies: secretsKey mirrors secrets' content, secrets itself is a fresh array most renders
	const { drafts, tokenNames, loginNames } = useMemo(() => {
		const byKey = new Map<string, SecretDraft>();
		for (const draft of secrets.map(parseSecretDraft)) {
			const existing = byKey.get(draft.key);
			if (!existing || (existing.focus === "url" && draft.focus !== "url")) {
				byKey.set(draft.key, draft);
			}
		}
		const drafts = [...byKey.values()];
		return {
			drafts,
			tokenNames: drafts.filter((draft) => draft.kind === "token").map((draft) => draft.key),
			loginNames: drafts.filter((draft) => draft.kind === "login").map((draft) => draft.key),
		};
	}, [secretsKey]);

	const phrases = [...phraseFor("token", tokenNames), ...phraseFor("login", loginNames)];
	const verb = pluralize(
		drafts.length,
		{
			one: t("agent.missing-secret.verb.one"),
			few: t("agent.missing-secret.verb.few"),
			many: t("agent.missing-secret.verb.many"),
		},
		false,
	);

	// Built as a flat node array rather than nested maps: only SecretName needs a `key` (React requires
	// one per list item, and the shorthand `<>` fragment can't carry one), so keying it directly avoids
	// wrapping every name and phrase in its own <Fragment key={...}>.
	const title: ReactNode[] = [verb];
	phrases.forEach((phrase, phraseIndex) => {
		title.push(phraseIndex > 0 ? ` ${t("agent.missing-secret.and")} ${phrase.noun} ` : ` ${phrase.noun} `);
		phrase.names.forEach((name, nameIndex) => {
			if (nameIndex > 0) title.push(", ");
			title.push(<SecretName key={name}>{name}</SecretName>);
		});
	});

	const description = t(
		drafts.length > 1 ? "agent.missing-secret.description-many" : "agent.missing-secret.description-one",
	);

	const handleAddSecrets = () => {
		if (!drafts.length) return;
		useAgentSecretDraftStore
			.getState()
			.setPendingDrafts(drafts.map(({ key, kind, focus }) => ({ key, kind, focus })));
		openAgentSecretsSettings();
	};

	return { title, description, handleAddSecrets };
};
