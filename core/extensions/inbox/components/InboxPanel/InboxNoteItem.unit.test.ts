import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { InboxNoteItem } from "./InboxNoteItem";

describe("InboxNoteItem", () => {
	it("shows a placeholder when the note content is empty", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(InboxNoteItem, {
					note: {
						id: "empty-note",
						title: "",
						editTree: { type: "doc", content: [{ type: "paragraph" }] },
						props: { author: "author@example.com", date: "2026-08-10T00:00:00.000Z" },
					},
					onDelete: () => {},
					onEdit: () => {},
				}),
			),
		);

		expect(screen.getByText("Note content is empty")).not.toBeNull();
	});

	it("renders TipTap marks without mounting an editor", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(InboxNoteItem, {
					note: {
						id: "formatted-note",
						title: "Formatted",
						editTree: {
							type: "doc",
							content: [
								{
									type: "paragraph",
									content: [{ type: "text", text: "Strong text", marks: [{ type: "strong" }] }],
								},
							],
						},
						props: { author: "author@example.com", date: "2026-08-10T00:00:00.000Z" },
					},
					onDelete: () => {},
					onEdit: () => {},
				}),
			),
		);

		expect(screen.getByText("Strong text").tagName).toBe("STRONG");
	});
});
