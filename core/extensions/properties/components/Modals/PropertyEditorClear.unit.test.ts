import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import PropertyEditor from "./PropertyEditor";

// gh#912: in the "Edit property" modal neither Style nor Icon could be cleared.
// Both clear buttons are rendered for real here (only the pickers' popover
// content and the unrelated heavy children are stubbed), so the test exercises
// the actual click path instead of a proxy.

// The name-uniqueness zod refine reads PropertyService.value.properties (a Map).
jest.mock("@ext/properties/components/PropertyService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { value: { properties: new Map() } },
}));

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
}));

// Keep the style enum tiny so the zod schema has a non-empty value list.
jest.mock("@components/HomePage/Cards/model/Style", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { solid: "solid" },
}));

// Children unrelated to clearing: the icon grid, the random-icon hook, the
// enum-values editor and the modals the editor may open.
jest.mock("@ext/markdown/elements/icon/edit/components/IconPicker/IconPicker", () => ({ IconPicker: () => null }));
jest.mock("@ext/markdown/elements/icon/edit/logic/hooks/useRandomIconPickerValue", () => ({
	useRandomIconPickerValue: () => () => {},
}));
jest.mock("@components/UnsavedChangesModal", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@ext/properties/components/Helpers/Values", () => ({ Values: () => null }));
jest.mock("@ext/properties/components/Modals/ActionWarning", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));

// The dialog shell only wraps the form; render it as plain containers.
jest.mock("@ui-kit/Dialog", () => {
	const react = require("react");
	const passthrough = ({ children }: { children: ReactNode }) => react.createElement("div", null, children);
	return {
		Dialog: passthrough,
		DialogBody: passthrough,
		DialogContent: passthrough,
		DialogDescription: passthrough,
		DialogTitle: passthrough,
		isFromModal: () => false,
	};
});

const renderEditor = (onSubmit: jest.Mock) => {
	// Real Radix Tooltip needs a provider ancestor; require avoids import-organizer churn.
	const { TooltipProvider } = require("@ui-kit/Tooltip");
	return render(
		createElement(
			TooltipProvider,
			null,
			createElement(PropertyEditor, {
				data: { id: "p1", name: "Status", type: "Text", style: "solid", icon: "star" } as never,
				properties: [],
				onSubmit,
			}),
		),
	);
};

describe("PropertyEditor clearing style and icon (gh#912)", () => {
	it("clears both fields in the UI and submits them as absent", async () => {
		const onSubmit = jest.fn();
		const { container } = renderEditor(onSubmit);

		// Both clear buttons are only rendered while the field holds a value.
		fireEvent.click(screen.getByTestId("style-clear"));
		fireEvent.click(screen.getByTestId("icon-clear"));

		// A cleared field must disappear from the UI. Writing `undefined` instead of
		// `null` would leave the old value on screen: react-hook-form resolves a
		// controlled field through `get(values, name, defaultValue)`, so `undefined`
		// falls back to the default value.
		await waitFor(() => expect(screen.queryByTestId("style-clear")).toBeNull());
		expect(screen.queryByTestId("icon-clear")).toBeNull();

		// `null` must not break validation — the form has to stay submittable.
		fireEvent.click(container.querySelector('button[type="submit"]') as HTMLButtonElement);
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

		// …and must reach onSubmit as "absent", never as a literal null:
		// Property.style/icon are not nullable, and only `undefined` is dropped by
		// the JSON.stringify that persists catalog props.
		const submitted = onSubmit.mock.calls[0][0];
		expect(submitted.style).toBeUndefined();
		expect(submitted.icon).toBeUndefined();
	});
});
