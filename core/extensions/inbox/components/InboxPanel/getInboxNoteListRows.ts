import type { InboxArticle } from "@ext/inbox/models/types";

export type InboxNoteListRow = { type: "editor"; id: string } | { type: "note"; id: string; note: InboxArticle };

export const getInboxNoteListRows = (notes: InboxArticle[], editingId: string | null): InboxNoteListRow[] => {
	const noteRows: InboxNoteListRow[] = notes.map((note) =>
		note.id === editingId ? { type: "editor", id: note.id } : { type: "note", id: note.id, note },
	);

	return editingId === null ? [{ type: "editor", id: "new-inbox-note" }, ...noteRows] : noteRows;
};
