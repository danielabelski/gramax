import t from "@ext/localization/locale/translate";

export const SECRET_FIELDS = ["login", "password", "token", "url"] as const;
export type SecretField = (typeof SECRET_FIELDS)[number];

export const getSecretFieldLabel = (field: SecretField): string => {
	switch (field) {
		case "login":
			return t("editor.keys-and-passwords.fields.login");
		case "password":
			return t("editor.keys-and-passwords.fields.password");
		case "token":
			return t("editor.keys-and-passwords.fields.token");
		case "url":
			return t("editor.keys-and-passwords.fields.url");
	}
};

export const SECRET_NAME_RE = new RegExp(`^(.*)\\.(${SECRET_FIELDS.join("|")})$`);

/** Renders a secret node's technical `name` (`key.field`) as a human-readable label (`key.Field`) for display. */
export const formatSecretName = (name: string): string => {
	const match = SECRET_NAME_RE.exec(name);
	if (!match) return name;
	const [, key, field] = match;
	return `${key}.${getSecretFieldLabel(field as SecretField)}`;
};
