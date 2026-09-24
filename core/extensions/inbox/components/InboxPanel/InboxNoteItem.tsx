import type { InboxArticle } from "@ext/inbox/models/types";
import { InboxNoteContent } from "./InboxNoteContent";
import { InboxNoteHeader } from "./InboxNoteHeader";

type InboxNoteItemProps = {
	note: InboxArticle;
	onDelete: (id: string) => void;
	onEdit: (note: InboxArticle) => void;
};

export const InboxNoteItem = ({ note, onDelete, onEdit }: InboxNoteItemProps) => (
	<div className="space-y-1 border-b px-4 py-3 last:border-b-0">
		<InboxNoteHeader note={note} onDelete={onDelete} onEdit={onEdit} />
		<InboxNoteContent editTree={note.editTree} />
	</div>
);
