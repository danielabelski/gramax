import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import InboxService from "@ext/inbox/components/InboxService";
import { INBOX_PANEL_ID } from "@ext/inbox/models/consts";
import t from "@ext/localization/locale/translate";
import { FloatingPanel, usePanelToggle } from "@ui-kit/FloatingPanel";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { useCallback, useRef } from "react";
import { InboxAuthorSelect } from "./InboxAuthorSelect";
import { InboxNoteForm } from "./InboxNoteForm";
import { InboxNoteList } from "./InboxNoteList";
import { InboxPanelActions } from "./InboxPanelActions";
import { useInboxData } from "./useInboxData";
import { useInboxEditing } from "./useInboxEditing";

export const InboxPanel = () => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const pageData = PageDataContextService.value;
	const currentUser = pageData.user.info?.mail;
	const deletingIds = useRef(new Set<string>());
	const { isOpen } = usePanelToggle(INBOX_PANEL_ID);
	const { authors, loadNotes, notes, selectedAuthor, setSelectedAuthor, shouldShow } = useInboxData(
		currentUser,
		isOpen,
	);
	const { discard, discardDeleted, editing, isSaving, saveAndClose, setEditing, start, switchEditing } =
		useInboxEditing({ currentUser, currentUserName: pageData.user.info?.name, loadNotes, selectedAuthor });

	const handleAuthorChange = useCallback(
		async (author: string) => {
			setSelectedAuthor(author);
			await loadNotes(author);
		},
		[loadNotes, setSelectedAuthor],
	);

	const handleDelete = useCallback(
		async (id: string) => {
			if (deletingIds.current.has(id)) return;
			deletingIds.current.add(id);
			let deletedNote: (typeof notes)[number] | undefined;

			try {
				if (!(await confirm(t("confirm-inbox-note-delete")))) return;
				deletedNote = notes.find((note) => note.id === id);
				if (!deletedNote) return;
				InboxService.removeItem(id);
				const response = await FetchService.fetch(apiUrlCreator.removeFileInGramaxDir(id, "inbox"));
				if (!response.ok) {
					InboxService.restoreItem(deletedNote);
					return;
				}
				discardDeleted(id);
			} catch (error) {
				if (deletedNote) InboxService.restoreItem(deletedNote);
				throw error;
			} finally {
				deletingIds.current.delete(id);
			}
		},
		[discardDeleted, notes],
	);

	return (
		<FloatingPanel
			headerActions={
				<InboxPanelActions
					disabled={!currentUser || selectedAuthor !== currentUser}
					onAdd={() => void start()}
				/>
			}
			icon="notebook-pen"
			id={INBOX_PANEL_ID}
			title={t("inbox.name")}
		>
			<ComponentVariantProvider variant="glass">
				<div className="flex min-h-0 flex-1 flex-col">
					{shouldShow && (
						<InboxAuthorSelect
							authors={authors}
							onBeforeChange={() => switchEditing(null)}
							onChange={handleAuthorChange}
							selectedAuthor={selectedAuthor}
						/>
					)}
					<InboxNoteList
						editingId={editing?.id}
						editor={
							editing ? (
								<InboxNoteForm
									draft={editing.draft}
									editTree={editing.editTree}
									id={editing.id ?? "new-inbox-note"}
									isSaving={isSaving}
									onChange={(draft, editTree) => setEditing({ ...editing, draft, editTree })}
									onDiscard={discard}
									onSave={saveAndClose}
								/>
							) : null
						}
						notes={notes}
						onDelete={(id) => void handleDelete(id)}
						onEdit={(note) => void start(note)}
					/>
				</div>
			</ComponentVariantProvider>
		</FloatingPanel>
	);
};
