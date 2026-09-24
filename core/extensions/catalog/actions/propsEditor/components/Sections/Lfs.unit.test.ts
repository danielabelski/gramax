/** biome-ignore-all lint/suspicious/noExplicitAny: the stubs stand in for whole ui-kit primitives */
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { FormData, FormProps } from "../../logic/createFormSchema";

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
}));

jest.mock("@components/Atoms/TagInputWithKeyboard", () => {
	const react = require("react");
	return {
		// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
		__esModule: true,
		// Only the locked entries matter here — the list the catalog cannot take anything out of.
		default: ({ lockedValues }: { lockedValues?: string[] }) =>
			react.createElement("div", { "data-locked": (lockedValues ?? []).join(" ") }),
	};
});

let mockWorkspace: any;

jest.mock("@core-ui/ContextServices/Workspace", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { current: () => mockWorkspace },
}));

jest.mock("@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider", () => ({
	useCatalogPropsStore: (selector: (s: unknown) => unknown) => selector({ data: { sourceName: "gitHub" } }),
}));

jest.mock("@ext/catalog/actions/propsEditor/components/Sections/SectionContainer", () => {
	const react = require("react");
	return { SectionContainer: ({ children }: { children?: ReactNode }) => react.createElement("div", null, children) };
});

jest.mock("@ext/settings/logic/hooks", () => ({ useSetting: () => ["en"] }));

jest.mock("@ext/storage/logic/utils/getPartSourceDataByStorageName", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => ({ sourceType: "GitHub" }),
}));

jest.mock("@ui-kit/Button", () => ({ IconButton: () => null }));

jest.mock("@ui-kit/Form", () => {
	const react = require("react");
	return {
		// The control is rendered, not just named: some cases are about what the field puts inside it.
		FormField: ({ name, control }: any) =>
			react.createElement("div", { "data-field": name }, control?.({ field: { value: [], onChange: () => {} } })),
	};
});

jest.mock("@ui-kit/Loader", () => {
	const react = require("react");
	return { Loader: (props: any) => react.createElement("span", { "data-testid": "loader", ...props }) };
});

jest.mock("@ui-kit/Switch", () => {
	const react = require("react");
	return {
		SwitchField: ({
			label,
			disabled,
			checked,
			onCheckedChange,
		}: {
			label?: ReactNode;
			disabled?: boolean;
			checked?: boolean;
			onCheckedChange?: (checked: boolean) => void;
		}) => {
			const labelChildren =
				typeof label === "object" && label !== null && "props" in label
					? (label.props as { children?: ReactNode }).children
					: label;
			const labelKey = react.Children.toArray(labelChildren)[0];
			const field = labelKey === "forms.catalog-edit-props.props.lfs.lazy.name" ? "lfs.lazy" : "lfs.auto";

			return react.createElement(
				"button",
				{
					"aria-checked": !!checked,
					"data-field": field,
					disabled,
					onClick: () => onCheckedChange?.(!checked),
					role: "switch",
				},
				label,
			);
		},
	};
});

jest.mock("@ui-kit/Tooltip", () => ({ Tooltip: () => null, TooltipContent: () => null, TooltipTrigger: () => null }));

// Stands in for the form's `lfs.auto`: the only thing the section watches, and what decides which of
// the two lists it shows.
let mockAuto = true;
let mockLazy = true;

jest.mock("react-hook-form", () => ({
	useWatch: ({ name }: { name: string }) => (name === "lfs.lazy" ? mockLazy : mockAuto),
}));

import { EditLfsProps } from "./Lfs";

const form = { control: {}, setValue: jest.fn() } as unknown as UseFormReturn<FormData>;
const formProps = { layout: "horizontal", labelClassName: "w-40" } as FormProps;

const renderSection = (autoLfsChecking?: boolean, lfsKnown?: boolean) =>
	render(createElement(EditLfsProps, { form, formProps, autoLfsChecking, lfsKnown, onToggleAutoLfs: jest.fn() }));

const autoSwitch = () =>
	screen.getByRole("switch", { name: "forms.catalog-edit-props.props.lfs.auto.name" }) as HTMLButtonElement;

// Every case but the workspace-managed one runs against a workspace that defines no masks of its own.
beforeEach(() => {
	form.setValue = jest.fn();
	mockWorkspace = {};
	mockAuto = true;
	mockLazy = true;
});

const fieldOrder = (container: HTMLElement) =>
	[...container.querySelectorAll("[data-field]")].map((el) => el.getAttribute("data-field"));

describe("EditLfsProps layout", () => {
	it("switched on, shows the switch and the exclusions it owns — the masks it maintains itself stay out", () => {
		const { container } = renderSection();

		expect(fieldOrder(container)).toEqual(["lfs.auto", "lfs.lazy", "lfs.exclude"]);
	});

	it("switched off, shows the mask list instead: nothing maintains it, so it is the user's again", () => {
		mockAuto = false;

		const { container } = renderSection();

		expect(fieldOrder(container)).toEqual(["lfs.auto", "lfs.lazy", "lfs.patterns"]);
	});
});

describe("EditLfsProps downloads", () => {
	it("shows auto-download off while lazy loading is enabled", () => {
		renderSection();

		expect(
			screen
				.getByRole("switch", { name: "forms.catalog-edit-props.props.lfs.lazy.name" })
				.getAttribute("aria-checked"),
		).toBe("false");
	});

	it("turns auto-download on by disabling lazy loading in the form", () => {
		renderSection();

		screen.getByRole("switch", { name: "forms.catalog-edit-props.props.lfs.lazy.name" }).click();

		expect(form.setValue).toHaveBeenCalledWith("lfs.lazy", false, { shouldDirty: true });
	});
});

describe("EditLfsProps while the enable is being checked", () => {
	it("shows a loader in the switch's title and takes the switch out of reach", () => {
		renderSection(true);

		expect(screen.getByTestId("loader")).toBeTruthy();
		expect(autoSwitch().contains(screen.getByTestId("loader"))).toBe(true);
		expect(autoSwitch().disabled).toBe(true);
	});

	it("shows no loader and leaves the switch usable when nothing is in flight", () => {
		renderSection(false);

		expect(screen.queryByTestId("loader")).toBeNull();
		expect(autoSwitch().disabled).toBe(false);
	});
});

describe("EditLfsProps when the catalog's LFS state could not be read", () => {
	it("takes the switch out of reach, so a click cannot enable on a guessed exclusion list", () => {
		renderSection(false, false);

		expect(autoSwitch().disabled).toBe(true);
	});

	it("leaves the switch usable once the state is known", () => {
		renderSection(false, true);

		expect(autoSwitch().disabled).toBe(false);
	});
});

describe("EditLfsProps under a workspace that states the auto-LFS policy", () => {
	const ges = (lfs: object) => ({ enterprise: { gesUrl: "https://ges.example" }, git: { lfs } });

	it("reads the switch on and locks it where the workspace asked for the auto-add", () => {
		mockWorkspace = ges({ auto: true });
		mockAuto = false;

		const { container } = renderSection();

		expect(autoSwitch().getAttribute("aria-checked")).toBe("true");
		// The policy is the administrator's, not this catalog's.
		expect(autoSwitch().disabled).toBe(true);
		expect(fieldOrder(container)).toEqual(["lfs.auto", "lfs.lazy", "lfs.exclude"]);
	});

	it("leaves the switch to the catalog where the workspace left it off — off is not a prohibition", () => {
		mockWorkspace = ges({ auto: false });
		mockAuto = true;

		const { container } = renderSection();

		expect(autoSwitch().getAttribute("aria-checked")).toBe("true");
		expect(autoSwitch().disabled).toBe(false);
		expect(fieldOrder(container)).toEqual(["lfs.auto", "lfs.lazy", "lfs.exclude"]);
	});

	it("keeps the switch on and locked even where the workspace also owns the masks", () => {
		mockWorkspace = ges({ auto: true, patterns: ["*.png"] });
		mockAuto = false;

		renderSection();

		// The sync keeps foreign masks while the policy is on, so the auto-add is not inert here.
		expect(autoSwitch().getAttribute("aria-checked")).toBe("true");
		expect(autoSwitch().disabled).toBe(true);
	});

	it("shows the workspace's exclusions in the catalog's list, and lets nobody take them out", () => {
		mockWorkspace = ges({ auto: true, exclude: ["*.psd"] });

		const { container } = renderSection();

		const locked = container.querySelector("[data-locked]").getAttribute("data-locked").split(" ");
		expect(locked).toContain("*.psd");
		// The defaults hold alongside them.
		expect(locked).toEqual(expect.arrayContaining(["*.svg", "*.html"]));
	});

	it("leaves the switch to the catalog where the workspace states only exclusions", () => {
		mockWorkspace = ges({ exclude: ["*.psd"] });

		renderSection();

		expect(autoSwitch().getAttribute("aria-checked")).toBe("true");
		expect(autoSwitch().disabled).toBe(false);
	});

	it("ignores the same policy in a workspace nobody administers", () => {
		mockWorkspace = { git: { lfs: { auto: false } } };
		mockAuto = true;

		renderSection();

		expect(autoSwitch().getAttribute("aria-checked")).toBe("true");
		expect(autoSwitch().disabled).toBe(false);
	});
});

describe("EditLfsProps in a workspace that defines the masks itself", () => {
	it("reads the switch off however `lfs.auto` is stored, and hides the exclusions with it", () => {
		mockWorkspace = { git: { lfs: { patterns: ["*.png"] } } };

		const { container } = renderSection();

		expect(autoSwitch().getAttribute("aria-checked")).toBe("false");
		expect(autoSwitch().disabled).toBe(true);
		// Reading off, it shows what an off switch shows: the masks, and none of the exclusions.
		expect(fieldOrder(container)).toEqual(["lfs.auto", "lfs.lazy", "lfs.patterns"]);
	});

	it("leaves a stored `lfs.auto` reading on where the workspace defines nothing", () => {
		const { container } = renderSection();

		expect(autoSwitch().getAttribute("aria-checked")).toBe("true");
		expect(container.querySelector('[data-field="lfs.exclude"]')).not.toBeNull();
	});
});
