/** Layout ids are derived from titles via `transliterate(…, { kebab: true })`, which already collapses whitespace runs. */
export const normalizeTitle = (value: string): string => value.trim().replace(/\s+/g, " ");
