import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import HomeLayoutEditBar from "./HomeLayoutEditBar";

jest.mock("@ext/localization/locale/translate", () => (key: string) => key);
jest.mock("@ui-kit/Button", () => ({
	Button: ({ children, ...props }: { children: ReactNode }) =>
		require("react").createElement("button", props, children),
	LoadingButtonTemplate: ({ className, size, text }: { className?: string; size?: string; text: string }) =>
		require("react").createElement(
			"div",
			{ "data-class": className, "data-size": size, "data-testid": "save-loading" },
			text,
		),
}));
jest.mock("@ui-kit/Divider", () => ({ Divider: () => null }));
jest.mock("@ui-kit/Icon", () => ({ Icon: () => null }));

describe("HomeLayoutEditBar", () => {
	test("shows LoadingButtonTemplate while saving", () => {
		render(
			createElement(HomeLayoutEditBar, {
				isSaving: true,
				onCancel: jest.fn(),
				onSave: jest.fn(),
				scope: "global",
			} as never),
		);

		const button = screen.getByTestId("save-loading");
		expect(button.textContent).toBe("save");
		expect(button.getAttribute("data-size")).toBe("xs");
		expect(button.getAttribute("data-class")).toContain("[&>div]:flex-row-reverse");
	});
});
