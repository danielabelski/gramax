import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { ChatDropdown, formatSessionAge, getDropdownLayout } from "./ChatDropdown";

describe("ChatDropdown", () => {
	it("passes the open dropdown state to the floating trigger button", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(ChatDropdown, {
					activeId: null,
					onClose: jest.fn(),
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
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(ChatDropdown, {
					activeId: "first",
					onClose: jest.fn(),
					onSelect: jest.fn(),
					sessions: [
						{ createdAt: Date.now() - 60_000, hasUserMessage: true, id: "first", title: "First chat" },
						{ createdAt: Date.now() - 3_600_000, hasUserMessage: true, id: "second", title: "Second chat" },
					],
				}),
			),
		);

		fireEvent.keyDown(screen.getByRole("button", { name: "Chat history" }), { key: "Enter" });
		fireEvent.change(screen.getByPlaceholderText("Search recent chats..."), { target: { value: "second" } });

		expect(screen.queryByText("First chat")).toBeNull();
		expect(screen.getByText("Second chat")).not.toBeNull();
	});

	it("keeps the date visible and moves deletion into the session actions menu", () => {
		const onClose = jest.fn();
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(ChatDropdown, {
					activeId: "first",
					onClose,
					onSelect: jest.fn(),
					sessions: [
						{ createdAt: Date.now() - 60_000, hasUserMessage: true, id: "first", title: "First chat" },
					],
				}),
			),
		);

		fireEvent.keyDown(screen.getByRole("button", { name: "Chat history" }), { key: "Enter" });
		const age = screen.getByText("1m");
		expect(age.className).not.toContain("group-hover:hidden");

		fireEvent.click(screen.getByRole("button", { name: "Actions" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Delete chat" }));

		expect(onClose).toHaveBeenCalledWith("first");
	});
});

describe("formatSessionAge", () => {
	it.each([
		[60_000, "1m"],
		[15 * 60 * 60_000, "15h"],
		[2 * 24 * 60 * 60_000, "2d"],
	])("formats an age of %i milliseconds", (age, expected) => {
		const now = 2_000_000_000;
		expect(formatSessionAge(now - age, now)).toBe(expected);
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
