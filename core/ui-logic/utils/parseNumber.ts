const isCommaSeparated = (value: string) => /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(value);
const isDotSeparated = (value: string) => /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(value);
const isNotNumber = (value: string) => /[^\d,.\s-]/g.test(value);
const isPlainNumber = (value: string) => /^-?\d+(\.\d+)?-?$/.test(value);

/**
 * Reads a number out of a human-written string: both the dot and the comma work as a decimal
 * separator, and a space, a comma or a dot may group thousands. Anything the rules cannot read
 * whole — a date such as `01.02.2020`, a mixed string such as `1. тесто` — yields `undefined`
 * rather than the number `parseFloat` would salvage from its prefix.
 */
const parseNumber = (value: string): number | undefined => {
	if (typeof value !== "string" || isNotNumber(value)) return;

	let ungrouped = value;
	if (isCommaSeparated(value)) ungrouped = value.replace(/,/g, " ");
	else if (isDotSeparated(value)) ungrouped = value.replace(/\./g, " ");

	const cleanedInput = ungrouped.replace(/[^\d,.-]/g, "").replace(",", ".");
	if (!isPlainNumber(cleanedInput)) return;

	const number = Number.parseFloat(cleanedInput);

	return Number.isNaN(number) ? undefined : number;
};

export default parseNumber;
