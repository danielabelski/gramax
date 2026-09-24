import type { InboxArticle } from "@ext/inbox/models/types";
import { getInboxNoteListRows } from "./getInboxNoteListRows";

const notes = ["first", "second"].map(
	(id): InboxArticle => ({
		id,
		title: id,
		editTree: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: id }] }] },
		props: { author: "author", date: "2026-08-10" },
	}),
);

describe("getInboxNoteListRows", () => {
	it("replaces the edited note with the editor row", () => {
		expect(getInboxNoteListRows(notes, "second").map((row) => `${row.type}:${row.id}`)).toEqual([
			"note:first",
			"editor:second",
		]);
	});

	it("places a new-note editor before existing notes", () => {
		expect(getInboxNoteListRows(notes, null).map((row) => `${row.type}:${row.id}`)).toEqual([
			"editor:new-inbox-note",
			"note:first",
			"note:second",
		]);
	});
});
