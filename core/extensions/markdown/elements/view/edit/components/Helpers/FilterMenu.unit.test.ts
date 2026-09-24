import type { PropertyFilter } from "@ext/markdown/elements/view/edit/components/Helpers/AddFilter";
import { PropertyTypes } from "@ext/properties/models";
import { fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, createElement, type ReactNode } from "react";

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
	hasTranslation: () => false,
}));

// Stub the ui-kit dropdown primitives (idiomatic here — see AppSettingsEditor.unit.test).
// DropdownMenuRadioGroup exposes its onValueChange via context; DropdownMenuRadioItem
// fires it with its own `value` on click — so the test observes exactly which value the
// group-by selection sends downstream (the crux of #829: id vs name).
jest.mock("@ui-kit/Dropdown", () => {
	const react = require("react");
	const Ctx = react.createContext({ onValueChange: (_value: string) => {} });
	return {
		// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
		__esModule: true,
		DropdownMenuRadioGroup: ({
			children,
			onValueChange,
		}: {
			children?: ReactNode;
			onValueChange?: (value: string) => void;
		}) => react.createElement(Ctx.Provider, { value: { onValueChange } }, children),
		DropdownMenuRadioItem: ({ children, value }: { children?: ReactNode; value?: string }) => {
			const ctx = react.useContext(Ctx);
			return react.createElement("button", { type: "button", onClick: () => ctx.onValueChange(value) }, children);
		},
		DropdownMenuItem: ({ children }: { children?: ReactNode }) => react.createElement("div", null, children),
		DropdownMenuCheckboxItem: ({ children }: { children?: ReactNode }) =>
			react.createElement("div", null, children),
		DropdownMenuSub: ({ children }: { children?: ReactNode }) => react.createElement("div", null, children),
		DropdownMenuSubTrigger: ({ children }: { children?: ReactNode }) => react.createElement("div", null, children),
		DropdownMenuSubContent: ({ children }: { children?: ReactNode }) => react.createElement("div", null, children),
	};
});

jest.mock("@ui-kit/Tooltip", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	TextOverflowTooltip: ({ children }: { children?: ReactNode }) =>
		require("react").createElement(require("react").Fragment, null, children),
}));

jest.mock("@ext/properties/components/Helpers/PropertiesScrollContainer", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: ({ children }: { children?: ReactNode }) => require("react").createElement("div", null, children),
}));

jest.mock("@ext/properties/components/Helpers/PropertyButtons", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));

jest.mock("@ui-kit/Checkbox", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	Checkbox: () => null,
}));

import FilterMenu from "./FilterMenu";

describe("FilterMenu group-by (single mode)", () => {
	test("selecting a property whose id differs from its name groups by the property id", () => {
		const updateFilter = jest.fn();

		const property = {
			id: "prop-1",
			name: "Status",
			type: PropertyTypes.enum,
			style: "blue",
			values: ["done"],
		} as PropertyFilter;

		const props: ComponentProps<typeof FilterMenu> = {
			noAssignedProperties: [property],
			updateFilter,
			mode: "single",
			availableValues: false,
			closeOnSelection: true,
		};

		render(createElement(FilterMenu, props));

		fireEvent.click(screen.getByText("Status"));

		// The Kanban group-by must send the property id, not its display name.
		expect(updateFilter).toHaveBeenCalledWith("prop-1", "prop-1");
	});
});
