import type { ClientWorkspaceConfig } from "@ext/workspace/WorkspaceConfig";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import EditWorkspaceFormBody from "./EditWorkspaceFormBody";

const mockOnSubmit = jest.fn();

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
}));

jest.mock("@ext/loggers/opentelemetry/span", () => ({ Level: {} }));

jest.mock("@core-ui/hooks/usePlatform", () => ({
	usePlatform: () => ({ isTauri: false, isDocportal: false }),
}));

jest.mock("@ext/settings/logic/hooks", () => ({
	useUpdateSettings: () => jest.fn(),
}));

jest.mock("@ext/workspace/components/useWorkspaceAi", () => ({
	useWorkspaceAi: () => ({
		saveData: jest.fn(),
		checkServer: jest.fn(async () => true),
		getData: jest.fn(async () => ({})),
		checkToken: jest.fn(async () => true),
		isChecking: false,
		isSaving: false,
	}),
}));

jest.mock("@ext/workspace/components/logic/useWorkspaceEditorActions", () => ({
	useWorkspaceEditorActions: (workspace: ClientWorkspaceConfig) => ({
		originalProps: workspace,
		workspaces: [workspace],
		pathPlaceholder: "",
		removeWorkspace: jest.fn(),
		onSubmit: mockOnSubmit,
		workspaceLogoProps: {},
		workspaceStyleProps: {},
	}),
}));

jest.mock("@ext/catalog/actions/propsEditor/components/Sections/SectionContainer", () => ({
	SectionContainer: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
}));
jest.mock("@ext/settings/components/SectionHeader", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@ext/settings/components/sections/AiSettingsFields", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@ext/settings/components/sections/ServicesSection", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));
jest.mock("@ext/workspace/components/EditCustomTheme", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));

jest.mock("@ext/markdown/elements/icon/edit/components/IconPicker/PopoverIconPicker", () => ({
	PopoverIconPicker: ({ label, onClear }: { label: string; onClear?: () => void }) =>
		require("react").createElement(
			"div",
			null,
			require("react").createElement("span", { "data-testid": "icon-label" }, label),
			require("react").createElement("button", { "data-testid": "icon-clear", onClick: onClear, type: "button" }),
		),
}));

// Real react-hook-form + zod resolver: the field wrapper only wires the controller and shows its error.
jest.mock("@ui-kit/Form", () => {
	const react = require("react");
	const { FormProvider, useController, useFormContext } = require("react-hook-form");

	const FormField = ({
		name,
		control,
	}: {
		name: string;
		control: (props: { field: unknown; fieldState: unknown }) => ReactNode;
	}) => {
		const form = useFormContext();
		const { field, fieldState } = useController({ name, control: form.control });
		return react.createElement(
			"div",
			null,
			control({ field, fieldState }),
			fieldState.error ? react.createElement("span", { role: "alert" }, fieldState.error.message) : null,
		);
	};

	return {
		Form: ({ children, ...methods }: { children: ReactNode }) =>
			react.createElement(FormProvider, methods, children),
		FormField,
		FormFooter: ({ leftContent, primaryButton }: { leftContent?: ReactNode; primaryButton?: ReactNode }) =>
			react.createElement("div", null, leftContent, primaryButton),
	};
});

jest.mock("@ui-kit/Input", () => ({
	Input: require("react").forwardRef((props: object, ref: unknown) =>
		require("react").createElement("input", { ...props, ref }),
	),
}));
jest.mock("@ui-kit/Loader", () => ({ Loader: () => null }));
jest.mock("@ui-kit/Button", () => ({
	Button: ({
		children,
		type,
		onClick,
		disabled,
	}: {
		children: ReactNode;
		type?: "button" | "submit";
		onClick?: () => void;
		disabled?: boolean;
	}) => require("react").createElement("button", { type, onClick, disabled }, children),
}));

const renderForm = async (workspace: ClientWorkspaceConfig) => {
	render(createElement(EditWorkspaceFormBody, { workspace }));
	await waitFor(() => expect(screen.getByDisplayValue(workspace.name)).toBeTruthy());
};

describe("EditWorkspaceFormBody icon", () => {
	beforeEach(() => {
		mockOnSubmit.mockReset();
	});

	it("saves a workspace whose stored icon is null", async () => {
		await renderForm({ path: "/ws", name: "Workspace", icon: null });

		fireEvent.click(screen.getByText("save"));

		await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("sends a cleared icon so the backend drops the previous one", async () => {
		await renderForm({ path: "/ws", name: "Workspace", icon: "layers" });

		fireEvent.click(screen.getByTestId("icon-clear"));
		fireEvent.click(screen.getByText("save"));

		await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled());
		const payload = JSON.parse(JSON.stringify(mockOnSubmit.mock.calls[0][0]));
		expect(payload).toHaveProperty("icon", null);
	});
});
