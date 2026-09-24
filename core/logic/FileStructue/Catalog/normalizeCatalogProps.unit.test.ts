import { type CatalogProps, normalizeCatalogProps } from "./CatalogProps";

const propsWithTitle = (title: unknown): CatalogProps => ({ title }) as CatalogProps;

describe("normalizeCatalogProps", () => {
	test("keeps string title and other properties", () => {
		const props: CatalogProps = { title: "Catalog", description: "Description" };

		expect(normalizeCatalogProps(props)).toEqual(props);
	});

	test.each([
		[123, "123"],
		[0, "0"],
		[true, "true"],
		[false, "false"],
	])("converts scalar title %p to string", (title, expected) => {
		expect(normalizeCatalogProps(propsWithTitle(title)).title).toBe(expected);
	});

	test.each([null, ["Catalog"], { ru: "Название" }])("removes unsupported title %p", (title) => {
		expect(normalizeCatalogProps(propsWithTitle(title))).not.toHaveProperty("title");
	});

	test("does not mutate source properties", () => {
		const props = propsWithTitle(123);

		const result = normalizeCatalogProps(props);

		expect(result).not.toBe(props);
		expect((props as { title: unknown }).title).toBe(123);
		expect(result.title).toBe("123");
	});
});
