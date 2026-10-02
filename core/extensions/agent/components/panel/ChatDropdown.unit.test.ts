import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { ChatDropdown, getDropdownLayout } from "./ChatDropdown";

const renderDropdown = (props: Partial<Parameters<typeof ChatDropdown>[0]> = {}) => {
	const onClose = jest.fn();
	const onRename = jest.fn();
	const onSelect = jest.fn();
	render(
		createElement(
			TooltipProvider,
			null,
			createElement(ChatDropdown, {
				activeId: "first",
				onClose,
				onRename,
				onSelect,
				sessions: [
					{ createdAt: Date.now() - 60_000, hasUserMessage: true, id: "first", title: "First chat" },
					{ createdAt: Date.now() - 3_600_000, hasUserMessage: true, id: "second", title: "Second chat" },
				],
				...props,
			}),
		),
	);

	fireEvent.keyDown(screen.getByRole("button", { name: "Chat history" }), { key: "Enter" });
	return { onClose, onRename, onSelect };
};

const startRenamingFirstChat = () => {
	fireEvent.keyDown(screen.getAllByRole("button", { name: "Actions" })[0], { key: "Enter" });
	fireEvent.click(screen.getByRole("menuitem", { name: "Rename chat" }));
	return screen.getByDisplayValue("First chat") as HTMLInputElement;
};

describe("ChatDropdown", () => {
	it("passes the open dropdown state to the floating trigger button", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(ChatDropdown, {
					activeId: null,
					onClose: jest.fn(),
					onRename: jest.fn(),
					onSelect: jest.fn(),
					sessions: [],
				}),
			),
		);

		const historyTrigger = screen.getByRole("button", { name: "Chat history" });
		fireEvent.keyDown(historyTrigger, { key: "Enter" });

		expect(historyTrigger.dataset.state).toBe("open");
	});

	it("shows recent chats and filters them by title", () => {
		renderDropdown();
		fireEvent.change(screen.getByPlaceholderText("Search recent chats..."), { target: { value: "second" } });

		expect(screen.queryByText("First chat")).toBeNull();
		expect(screen.getByText("Second chat")).not.toBeNull();
	});

	it("keeps the date visible when row actions are available", () => {
		renderDropdown({
			sessions: [{ createdAt: Date.now() - 60_000, hasUserMessage: true, id: "first", title: "First chat" }],
		});

		expect(document.querySelector(".shrink-0.text-muted")?.className).not.toContain("group-hover:hidden");
	});

	// two nested modal menus is expected here: while the actions popup has focus, radix marks
	// everything below it (including the history trigger) aria-hidden, same as any modal-in-modal —
	// this only checks the actions popup itself renders and the row underneath isn't torn down
	it("opens a row's actions menu without closing the history menu", () => {
		renderDropdown();
		const actionsTrigger = screen.getAllByRole("button", { name: "Actions" })[0];

		fireEvent.keyDown(actionsTrigger, { key: "Enter" });

		expect(screen.getByRole("menuitem", { name: "Rename chat" })).not.toBeNull();
		expect(screen.getByText("First chat")).not.toBeNull();
	});

	it("selects the current title when renaming starts", () => {
		renderDropdown();
		const input = startRenamingFirstChat();

		expect(document.activeElement).toBe(input);
		expect([input.selectionStart, input.selectionEnd]).toEqual([0, "First chat".length]);
	});

	// a click inside the actions popup is still a React-tree descendant of the row despite rendering
	// in a portal, so without stopping it there it also fires the row's own onSelect (opening the chat)
	it("does not select the chat when renaming starts from its actions menu", () => {
		const { onSelect } = renderDropdown();
		startRenamingFirstChat();

		expect(onSelect).not.toHaveBeenCalled();
	});

	// the menu focuses the hovered row and takes focus back when the pointer leaves it, which would blur
	// the input; rows cancel those events so the menu skips its own handlers. jsdom drops `pointerType`,
	// so the menu's mouse-only handlers never run here — cancellation is what this can actually assert.
	it("cancels the pointer events the menu uses to move focus while renaming", () => {
		renderDropdown();
		const input = startRenamingFirstChat();
		const editedRow = input.closest("[role='menuitem']");
		const otherRow = screen.getByText("Second chat").closest("[role='menuitem']");

		expect(fireEvent.pointerLeave(editedRow, { cancelable: true })).toBe(false);
		expect(fireEvent.pointerMove(otherRow)).toBe(false);
	});

	it("renames a chat on enter", () => {
		const { onRename } = renderDropdown();
		const input = startRenamingFirstChat();

		fireEvent.change(input, { target: { value: "Renamed chat" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(onRename).toHaveBeenCalledWith("first", "Renamed chat");
	});

	it("keeps the old title when renaming is cancelled with escape", () => {
		const { onRename } = renderDropdown();
		const input = startRenamingFirstChat();

		fireEvent.change(input, { target: { value: "Renamed chat" } });
		fireEvent.keyDown(input, { key: "Escape" });

		expect(onRename).not.toHaveBeenCalled();
		expect(screen.getByText("First chat")).not.toBeNull();
	});

	it("keeps the old title when the rename is submitted empty", () => {
		const { onRename } = renderDropdown();
		const input = startRenamingFirstChat();

		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(onRename).not.toHaveBeenCalled();
		expect(screen.getByText("First chat")).not.toBeNull();

		fireEvent.keyDown(screen.getAllByRole("button", { name: "Actions" })[0], { key: "Enter" });
		fireEvent.click(screen.getByRole("menuitem", { name: "Rename chat" }));
		expect(screen.getByDisplayValue("First chat")).not.toBeNull();
	});

	it("deletes a chat from the actions menu", () => {
		const { onClose, onSelect } = renderDropdown();

		fireEvent.keyDown(screen.getAllByRole("button", { name: "Actions" })[0], { key: "Enter" });
		fireEvent.click(screen.getByRole("menuitem", { name: "Delete chat" }));

		expect(onClose).toHaveBeenCalledWith("first");
		expect(onSelect).not.toHaveBeenCalled();
	});
});

describe("getDropdownLayout", () => {
	it("aligns the dropdown with both inner panel edges", () => {
		expect(getDropdownLayout({ left: 52, width: 642 }, { left: 429 }, 16)).toEqual({
			alignOffset: -361,
			width: 610,
		});
	});
});
