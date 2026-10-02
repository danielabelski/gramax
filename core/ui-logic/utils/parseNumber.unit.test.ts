import parseNumber from "@core-ui/utils/parseNumber";

describe("parseNumber", () => {
	test("1000000,45", () => {
		const expected = 1000000.45;
		const result = parseNumber("1000000,45");
		expect(result).toBe(expected);
	});

	test("1000000.45", () => {
		const expected = 1000000.45;
		const result = parseNumber("1000000.45");
		expect(result).toBe(expected);
	});

	test("1 000 000,45", () => {
		const expected = 1000000.45;
		const result = parseNumber("1 000 000,45");
		expect(result).toBe(expected);
	});

	test("1 000 000.45", () => {
		const expected = 1000000.45;
		const result = parseNumber("1 000 000.45");
		expect(result).toBe(expected);
	});

	test("-1 000 000,45", () => {
		const expected = -1000000.45;
		const result = parseNumber("-1 000 000,45");
		expect(result).toBe(expected);
	});

	test("1 000 000,45-", () => {
		const expected = 1000000.45;
		const result = parseNumber("1 000 000,45-");
		expect(result).toBe(expected);
	});

	test("1,000,000.45", () => {
		const expected = 1000000.45;
		const result = parseNumber("1,000,000.45");
		expect(result).toBe(expected);
	});

	test("-1,000,000.45", () => {
		const expected = -1000000.45;
		const result = parseNumber("-1,000,000.45");
		expect(result).toBe(expected);
	});

	test("1.000.000,45", () => {
		const expected = 1000000.45;
		const result = parseNumber("1.000.000,45");
		expect(result).toBe(expected);
	});

	test("-1.000.000,45", () => {
		const expected = -1000000.45;
		const result = parseNumber("-1.000.000,45");
		expect(result).toBe(expected);
	});

	test("не парсит строку с нечисловым символом", () => {
		const expected = undefined;
		const result = parseNumber("1. тесто");
		expect(result).toBe(expected);
	});
	test("не парсит дату как число", () => {
		const expected = undefined;
		const result = parseNumber("01.02.2020");
		expect(result).toBe(expected);
	});

	test("читает дробь меньше единицы с запятой", () => {
		const expected = 0.03;
		const result = parseNumber("0,03");
		expect(result).toBe(expected);
	});
});
