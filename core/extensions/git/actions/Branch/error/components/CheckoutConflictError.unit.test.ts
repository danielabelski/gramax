import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import CheckoutConflictErrorComponent from "./CheckoutConflictError";

jest.mock("@ext/errorHandlers/client/components/DialogErrorHeader", () => ({
	DialogErrorHeader: ({ title }: { title: string }) => require("react").createElement("h1", null, title),
}));

jest.mock("@ext/localization/locale/translate", () => (key: string) => key);

jest.mock("@ui-kit/Dialog", () => ({
	DialogBody: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	DialogFooterTemplate: ({ primaryButton }: { primaryButton: string }) =>
		require("react").createElement("button", null, primaryButton),
}));

describe("CheckoutConflictErrorComponent", () => {
	it("shows separate diagnosis and recipe with a close button", () => {
		render(createElement(CheckoutConflictErrorComponent, { error: {} as never, onCancelClick: jest.fn() }));

		expect(screen.getByText("git.checkout.error.conflict-diagnosis")).toBeTruthy();
		expect(screen.getByText("git.checkout.error.conflict-recipe")).toBeTruthy();
		expect(screen.getByRole("button", { name: "close" })).toBeTruthy();
	});
});
