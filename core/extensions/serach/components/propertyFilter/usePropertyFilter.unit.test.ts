import { type Property, PropertyTypes } from "@ext/properties/models";
import {
	type UsePropertyFilterResult,
	usePropertyFilter,
} from "@ext/serach/components/propertyFilter/usePropertyFilter";
import { act, renderHook } from "@testing-library/react";
import { makeProperty } from "../model/__tests__/fixtures";

const propertyMap = (...properties: Property[]) => new Map(properties.map((property) => [property.id, property]));

const status = makeProperty("status", PropertyTypes.enum, ["open", "done"]);
const owner = makeProperty("owner", PropertyTypes.many, ["ann", "bob"]);

const render = (properties = propertyMap(status, owner), isReadOnlyPlatform = false) =>
	renderHook(() => usePropertyFilter({ properties, isReadOnlyPlatform }));

const controller = (result: { current: UsePropertyFilterResult }, id: string) =>
	result.current.controllers.find((x) => x.item.property.id === id);

const selectedValues = (result: { current: UsePropertyFilterResult }, id: string) =>
	result.current.selected
		.find((item) => item.property.id === id)
		?.selection.options.filter((option) => option.selected)
		.map((option) => option.value);

describe("usePropertyFilter", () => {
	describe("available properties", () => {
		it("offers one controller per filterable property", () => {
			const { result } = render();

			expect(result.current.controllers.map((x) => x.item.property.id)).toEqual(["status", "owner"]);
			expect(result.current.selected).toEqual([]);
		});

		it("skips property types that cannot be filtered", () => {
			const properties = propertyMap(status, makeProperty("notes", PropertyTypes.text, []));
			const { result } = render(properties);

			expect(result.current.controllers.map((x) => x.item.property.id)).toEqual(["status"]);
		});

		it("hides properties not published to the docportal on a read-only platform", () => {
			const hidden = makeProperty("hidden", PropertyTypes.enum, ["x"]);
			const shown = { ...makeProperty("shown", PropertyTypes.enum, ["x"]), options: { docportalVisible: true } };
			const { result } = render(propertyMap(hidden, shown), true);

			expect(result.current.controllers.map((x) => x.item.property.id)).toEqual(["shown"]);
		});
	});

	describe("selection", () => {
		it("drops the property once its last value is deselected", () => {
			const { result } = render();

			act(() => controller(result, "status").toggleValue("open"));
			expect(selectedValues(result, "status")).toEqual(["open"]);

			act(() => controller(result, "status").toggleValue("open"));
			expect(result.current.selected).toEqual([]);
		});

		it("keeps selections of different properties apart", () => {
			const { result } = render();

			act(() => controller(result, "status").toggleValue("open"));
			act(() => controller(result, "owner").toggleValue("bob"));

			expect(selectedValues(result, "status")).toEqual(["open"]);
			expect(selectedValues(result, "owner")).toEqual(["bob"]);
		});

		it("selects every value and empty together, then drops the property", () => {
			const { result } = render();

			act(() => controller(result, "status").toggleAll());
			expect(selectedValues(result, "status")).toEqual(["open", "done"]);
			expect(result.current.selected[0].selection.emptySelected).toBe(true);

			act(() => controller(result, "status").toggleAll());
			expect(result.current.selected).toEqual([]);
		});

		it("toggles the empty value on its own", () => {
			const { result } = render();

			act(() => controller(result, "status").toggleEmpty());

			expect(result.current.selected[0].selection.emptySelected).toBe(true);
			expect(selectedValues(result, "status")).toEqual([]);
		});

		it("drops one property from the selection", () => {
			const { result } = render();
			act(() => controller(result, "status").toggleValue("open"));
			act(() => controller(result, "owner").toggleValue("bob"));

			act(() => controller(result, "status").clear());

			expect(result.current.selected.map((item) => item.property.id)).toEqual(["owner"]);
		});

		it("drops every property from the selection", () => {
			const { result } = render();
			act(() => controller(result, "status").toggleValue("open"));
			act(() => controller(result, "owner").toggleValue("bob"));

			act(() => result.current.clearFilteredProperties());

			expect(result.current.selected).toEqual([]);
		});
	});

	describe("property name filter", () => {
		it("marks only matching properties as shown, case-insensitively", () => {
			const { result } = render();

			act(() => result.current.filter.set("OWN"));

			expect(result.current.filter.value).toBe("own");
			expect(result.current.controllers.map((x) => [x.item.property.id, x.item.shown])).toEqual([
				["status", false],
				["owner", true],
			]);
		});
	});

	describe("property values filter", () => {
		it("marks only matching values as shown for that property alone", () => {
			const { result } = render();

			act(() => controller(result, "status").valuesFilter.set("Do"));

			expect(controller(result, "status").valuesFilter.value).toBe("do");
			expect(controller(result, "status").item.selection.options.map((o) => [o.value, o.shown])).toEqual([
				["open", false],
				["done", true],
			]);
			expect(controller(result, "owner").item.selection.options.every((o) => o.shown)).toBe(true);
		});
	});
});
