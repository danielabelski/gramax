import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import Folder from "./Folder";

jest.mock("@ext/localization/locale/translate", () => (key: string) => key);
jest.mock("@ui-kit/Card", () => ({
	ActionCard: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	CardFolder: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	CardMenuTrigger: () => null,
	CardSubTitle: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	CardTitle: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
}));
jest.mock("@ui-kit/Dropdown", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => children,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => children,
	DropdownMenuItem: ({ children }: { children: ReactNode }) => children,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("./FolderCatalogThumbs", () => ({ FolderCatalogThumbs: () => null }));

describe("Folder rename", () => {
	test("does not save a renamed folder after Escape", () => {
		const onTitleChange = jest.fn();
		render(
			createElement(Folder, {
				folder: { type: "folder", id: "docs", title: "Before", items: [] },
				isRenaming: true,
				linkByName: {},
				onTitleChange,
			}),
		);

		const input = screen.getByLabelText("folder-title");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "After" } });
		fireEvent.keyDown(input, { key: "Escape" });
		fireEvent.blur(input);

		expect(onTitleChange).not.toHaveBeenCalled();
	});

	test("does not save an empty title and keeps the previous one", () => {
		const onTitleChange = jest.fn();
		render(
			createElement(Folder, {
				folder: { type: "folder", id: "docs", title: "Before", items: [] },
				isRenaming: true,
				linkByName: {},
				onTitleChange,
			}),
		);

		const input = screen.getByLabelText("folder-title");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.blur(input);

		expect(onTitleChange).not.toHaveBeenCalled();
	});

	test("collapses repeated whitespace in a saved title", () => {
		const onTitleChange = jest.fn();
		render(
			createElement(Folder, {
				folder: { type: "folder", id: "docs", title: "Before", items: [] },
				isRenaming: true,
				linkByName: {},
				onTitleChange,
			}),
		);

		const input = screen.getByLabelText("folder-title");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "  New   folder  " } });
		fireEvent.blur(input);

		expect(onTitleChange).toHaveBeenCalledWith("New folder");
	});
});
