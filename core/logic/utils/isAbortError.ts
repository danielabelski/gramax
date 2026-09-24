export const isAbortError = (error: unknown): boolean =>
	typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError";
