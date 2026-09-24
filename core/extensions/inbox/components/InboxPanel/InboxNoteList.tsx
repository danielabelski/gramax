import type { InboxArticle } from "@ext/inbox/models/types";
import t from "@ext/localization/locale/translate";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	PanelEmptyState,
	PanelEmptyStateDescription,
	PanelEmptyStateIcon,
	PanelEmptyStateTitle,
} from "@ui-kit/FloatingPanel";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { type ReactNode, useMemo, useRef } from "react";
import { getInboxNoteListRows } from "./getInboxNoteListRows";
import { InboxNoteItem } from "./InboxNoteItem";

type InboxNoteListProps = {
	notes: InboxArticle[];
	onDelete: (id: string) => void;
	onEdit: (note: InboxArticle) => void;
	editingId?: string | null;
	editor?: ReactNode;
};

const ESTIMATED_NOTE_HEIGHT = 88;

export const InboxNoteList = ({ notes, onDelete, onEdit, editingId, editor }: InboxNoteListProps) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const isEditing = editingId !== undefined;
	const rows = useMemo(() => getInboxNoteListRows(notes, editingId ?? null), [editingId, notes]);
	const virtualizer = useVirtualizer({
		count: notes.length,
		estimateSize: () => ESTIMATED_NOTE_HEIGHT,
		getItemKey: (index) => notes[index].id,
		getScrollElement: () => scrollRef.current,
		overscan: 5,
	});
	const renderRow = (row: (typeof rows)[number]) =>
		row.type === "editor" ? editor : <InboxNoteItem note={row.note} onDelete={onDelete} onEdit={onEdit} />;

	if (notes.length === 0 && !isEditing)
		return (
			<PanelEmptyState>
				<PanelEmptyStateIcon icon="file" />
				<PanelEmptyStateTitle>{t("inbox.empty-state.title")}</PanelEmptyStateTitle>
				<PanelEmptyStateDescription className="max-w-64 whitespace-pre-line">
					{t("inbox.empty-state.description")}
				</PanelEmptyStateDescription>
			</PanelEmptyState>
		);

	return (
		<ScrollShadowContainer className="min-h-0 flex-1 overflow-x-hidden" ref={scrollRef}>
			{isEditing ? (
				<div>
					{rows.map((row) => (
						<div key={`${row.type}:${row.id}`}>{renderRow(row)}</div>
					))}
				</div>
			) : (
				<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const note = notes[virtualRow.index];
						return (
							<div
								className="absolute left-0 top-0 w-full"
								data-index={virtualRow.index}
								key={virtualRow.key}
								ref={virtualizer.measureElement}
								style={{ transform: `translateY(${virtualRow.start}px)` }}
							>
								<InboxNoteItem note={note} onDelete={onDelete} onEdit={onEdit} />
							</div>
						);
					})}
				</div>
			)}
		</ScrollShadowContainer>
	);
};
