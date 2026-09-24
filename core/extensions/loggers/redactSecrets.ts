/**
 * Key-name based secret masking, shared by every logging sink that serializes arbitrary objects.
 *
 * Spans capture call arguments and results as-is, and application objects reach the config
 * (`AppConfig.admin.password`, `AppConfig.portalAi.token`, `AppConfig.tokens.*`) through ordinary
 * fields — so a serializer that walks deep enough writes credentials into the log files.
 * Masking by key name is the only defense that holds without every call site remembering to opt out.
 *
 * It has one blind spot by construction: a credential passed as a bare positional parameter reaches the
 * encoder inside an array, where there is no key to match on. Such a call must set `omitArgs`; likewise
 * a call whose return value is or embeds a credential must set `omitResult`.
 */

export const REDACTED = "<redacted>";

/** Substrings that mark a property as credential-bearing. Matched against the normalized key. */
const SECRET_KEY_PARTS = [
	"password",
	"passwd",
	"passphrase",
	"secret",
	"token",
	"apikey",
	"accesskey",
	"privatekey",
	"credential",
	"authorization",
	"cookie",
	"sessionid",
	"onetimecode",
];

const normalize = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * True when a property under this name may hold a credential and its whole subtree must be masked.
 * Deliberately broad: masking a harmless `tokens` array costs a line of log detail, leaking
 * `ADMIN_PASSWORD` costs the installation.
 */
export const isSecretKey = (key: string): boolean => {
	const normalized = normalize(key);
	return SECRET_KEY_PARTS.some((part) => normalized.includes(part));
};
