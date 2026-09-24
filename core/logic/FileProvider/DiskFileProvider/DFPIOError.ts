export interface IoErrorBuilder {
	name: string;
	code: string;
	message: string;
}

export default class IoError extends Error {
	code: string;

	constructor({ name, code, message, cause }: IoErrorBuilder & { cause?: Error }) {
		super(message, { cause });
		this.name = name;
		this.code = code;
	}
}

/**
 * The refusal as it arrives from rustcall — `EPERM` from a TCC-protected directory on macOS and
 * `EACCES` from one the mode bits hide both land here. Two spellings because two error types
 * cross the bridge: `IoError::PermissionDenied` from the fs commands, `Error::PermissionDenied`
 * from the core scan commands, and serde renames the latter to camelCase.
 *
 * A refusal is not an absence: callers that swallow "the directory isn't there" must let it pass.
 */
export const isPermissionDenied = (e: unknown): boolean => {
	const { code, name } = (e ?? {}) as { code?: string; name?: string };
	return [code, name].some((v) => v?.toLowerCase() === "permissiondenied");
};
