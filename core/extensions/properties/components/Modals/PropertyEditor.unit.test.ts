import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import PropertyEditor from "./PropertyEditor";

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

// Heavy children that live inside FormFields we stub away — never reached here.
jest.mock("@components/UnsavedChangesModal", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@ext/markdown/elements/icon/edit/components/IconPicker/PopoverIconPicker", () => ({
	PopoverIconPicker: () => null,
}));
jest.mock("@ext/properties/components/Helpers/Values", () => ({ Values: () => null }));
jest.mock("@ext/properties/components/Modals/ActionWarning", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@ext/properties/components/PropertyStylePicker", () => ({ PropertyStylePicker: () => null }));

// UI-kit primitives that are not under test — stub to plain elements / nulls.
jest.mock("@ui-kit/Dialog", () => ({
	Dialog: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	DialogBody: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	DialogContent: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
}));
jest.mock("@ui-kit/Checkbox", () => ({ CheckboxField: () => null }));
jest.mock("@ui-kit/ErrorState", () => ({ ErrorState: () => null }));
jest.mock("@ui-kit/Input", () => ({ Input: () => null }));
jest.mock("@ui-kit/Loader", () => ({ Loader: () => null }));
jest.mock("@ui-kit/Popover", () => ({
	Popover: () => null,
	PopoverContent: () => null,
	PopoverTriggerButton: () => null,
}));
jest.mock("@ui-kit/Select", () => ({
	Select: () => null,
	SelectContent: () => null,
	SelectItem: () => null,
	SelectTrigger: () => null,
	SelectValue: () => null,
}));
jest.mock("@ui-kit/Button", () => ({
	Button: ({ children, type }: { children: ReactNode; type?: "button" | "submit" }) =>
		require("react").createElement("button", { type }, children),
	IconButton: () => null,
	InlineTriggerButton: () => null,
}));
// Render the info icon as a locatable marker; the tooltip trigger wraps it.
jest.mock("@ui-kit/Icon", () => ({
	Icon: ({ icon }: { icon: string }) => require("react").createElement("span", { "data-testid": `icon-${icon}` }),
}));

// @ui-kit/Form: keep PropertyEditor's own <form onSubmit> (its own JSX, not from
// here) intact; only surface the footer's leftContent, where the tooltip lives.
jest.mock("@ui-kit/Form", () => {
	const react = require("react");
	return {
		Form: ({ children }: { children: ReactNode }) => react.createElement(react.Fragment, null, children),
		FormField: () => null,
		FormFieldSet: () => null,
		FormStack: ({ children }: { children: ReactNode }) => react.createElement("div", null, children),
		FormHeader: () => null,
		FormFooter: ({
			leftContent,
			primaryButton,
			secondaryButton,
		}: {
			leftContent?: ReactNode;
			primaryButton?: ReactNode;
			secondaryButton?: ReactNode;
		}) => react.createElement("div", null, leftContent, primaryButton, secondaryButton),
	};
});

// @ui-kit/Tooltip is intentionally NOT mocked — the real TooltipTrigger is what
// this test exercises. Without `asChild` it renders a bare <button> (no type),
// which inside a <form> defaults to type="submit" and submits on click (#877/#878).

describe("PropertyEditor docportal-visibility info tooltip", () => {
	it("clicking the info icon does not submit the property form", () => {
		const onSubmit = jest.fn();
		// Real Radix Tooltip needs a provider ancestor; require avoids import-organizer churn.
		const { TooltipProvider } = require("@ui-kit/Tooltip");
		const { container } = render(
			createElement(
				TooltipProvider,
				null,
				createElement(PropertyEditor, { data: {} as never, properties: [], onSubmit }),
			),
		);

		const form = container.querySelector("form");
		expect(form).not.toBeNull();

		const submitted = jest.fn((e: Event) => e.preventDefault());
		form?.addEventListener("submit", submitted);

		const trigger = screen.getByTestId("icon-info").parentElement as HTMLElement;
		fireEvent.click(trigger);

		expect(submitted).not.toHaveBeenCalled();
	});
});
