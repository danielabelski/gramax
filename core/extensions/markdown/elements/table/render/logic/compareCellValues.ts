import parseNumber from "@core-ui/utils/parseNumber";

/**
 * Compares two table cell values. Numeric values are compared as numbers: Intl's `numeric: true`
 * collation reads each digit run as a bare integer, so it ranks "0.1" below "0.03". Everything
 * else keeps the natural-order string comparison.
 */
const compareCellValues = (a: string, b: string): number => {
	const aNumber = parseNumber(a);
	const bNumber = parseNumber(b);

	if (aNumber !== undefined && bNumber !== undefined) return aNumber - bNumber;

	return a.localeCompare(b, undefined, { numeric: true });
};

export default compareCellValues;
