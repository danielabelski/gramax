import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode, useState } from "react";
import GroupHeader from "./GroupHeader";

jest.mock("@ext/localization/locale/translate", () => (key: string) => key);
jest.mock("@ui-kit/Button", () => ({ IconButton: () => null }));
jest.mock("@ui-kit/Dropdown", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => children,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => children,
	DropdownMenuItem: ({ children }: { children: ReactNode }) => children,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@ui-kit/Tooltip", () => ({
	Tooltip: ({ children }: { children: ReactNode }) => children,
	TooltipContent: ({ children }: { children: ReactNode }) => children,
	TooltipTrigger: ({ children }: { children: ReactNode }) => children,
}));

const RenamingHeader = ({ onTitleChange }: { onTitleChange: jest.Mock }) => {
	const [isRenaming, setRenaming] = useState(true);
	return createElement(GroupHeader, {
		editActions: {
			onTitleChange,
			onConvertToFolder: () => {},
			convertToFolderDisabled: false,
			onDelete: () => {},
		},
		renameState: { isRenaming, onRenamingChange: setRenaming },
		title: "Before",
	});
};

describe("GroupHeader rename", () => {
	test("does not save a renamed section after Escape", () => {
		const onTitleChange = jest.fn();
		render(createElement(RenamingHeader, { onTitleChange }));

		const input = screen.getByLabelText("section-title");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "After" } });
		fireEvent.keyDown(input, { key: "Escape" });
		fireEvent.blur(input);

		expect(onTitleChange).not.toHaveBeenCalled();
	});

	test("does not save an empty title and keeps the previous one", () => {
		const onTitleChange = jest.fn();
		render(createElement(RenamingHeader, { onTitleChange }));

		const input = screen.getByLabelText("section-title");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.blur(input);

		expect(onTitleChange).not.toHaveBeenCalled();
	});

	test("collapses repeated whitespace in a saved title", () => {
		const onTitleChange = jest.fn();
		render(createElement(RenamingHeader, { onTitleChange }));

		const input = screen.getByLabelText("section-title");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "  New   section  " } });
		fireEvent.blur(input);

		expect(onTitleChange).toHaveBeenCalledWith("New section");
	});
});
