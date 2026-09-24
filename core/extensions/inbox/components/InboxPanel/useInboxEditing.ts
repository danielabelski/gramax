import generateUniqueID from "@core/utils/generateUniqueID";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import AuthorInfoCodec from "@core-ui/utils/authorInfoCodec";
import { getDraftTransition, type InboxDraft } from "@ext/inbox/logic/inboxEditingSession";
import type { InboxArticle } from "@ext/inbox/models/types";
import type { JSONContent } from "@tiptap/react";
import { useCallback, useState } from "react";

export type InboxEditingSession = {
	id: string | null;
	draft: InboxDraft;
	props?: InboxArticle["props"];
	editTree: JSONContent | null;
};

type UseInboxEditingProps = {
	currentUser?: string;
	currentUserName?: string;
	loadNotes: (author: string) => Promise<void>;
	selectedAuthor: string;
};

const EMPTY_DRAFT: InboxDraft = { title: "", content: "" };

const getText = (node: JSONContent): string =>
	node.text ?? node.content?.map(getText).join("\n").replace(/\n+/g, "\n").trim() ?? "";

export const useInboxEditing = ({ currentUser, currentUserName, loadNotes, selectedAuthor }: UseInboxEditingProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const [editing, setEditing] = useState<InboxEditingSession | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const save = useCallback(async () => {
		if (!editing || getDraftTransition(editing.draft) === "close") return true;
		setIsSaving(true);
		const id = editing.id ?? generateUniqueID();
		const props =
			editing.props ??
			({
				date: new Date().toISOString(),
				author: AuthorInfoCodec.serialize({
					name: currentUserName ?? "admin",
					email: currentUser ?? "admin",
				}),
			} as InboxArticle["props"]);

		if (!editing.id) {
			const response = await FetchService.fetch(
				apiUrlCreator.createFileInGramaxDir(id, "inbox"),
				JSON.stringify({ props }),
			);
			if (!response.ok) {
				setIsSaving(false);
				return false;
			}
		}

		const response = await FetchService.fetch(
			apiUrlCreator.updateFileInGramaxDir(id, "inbox"),
			JSON.stringify({ editTree: editing.editTree, props: { ...props, title: editing.draft.title } }),
		);
		setIsSaving(false);
		if (!response.ok) return false;
		await loadNotes(selectedAuthor);
		return true;
	}, [currentUser, currentUserName, editing, loadNotes, selectedAuthor]);

	const switchEditing = useCallback(
		async (next: InboxEditingSession | null) => {
			if (editing && getDraftTransition(editing.draft) === "commit" && !(await save())) return false;
			setEditing(next);
			return true;
		},
		[editing, save],
	);

	const start = useCallback(
		async (note?: InboxArticle) => {
			if (!(await switchEditing(null))) return;
			if (!note) {
				setEditing({
					id: null,
					draft: EMPTY_DRAFT,
					editTree: { type: "doc", content: [{ type: "paragraph" }] },
				});
				return;
			}

			setEditing({
				id: note.id,
				draft: { title: note.title, content: getText(note.editTree) },
				editTree: note.editTree,
				props: note.props,
			});
		},
		[switchEditing],
	);

	const saveAndClose = useCallback(async () => {
		if (await save()) setEditing(null);
	}, [save]);

	const discardDeleted = useCallback((id: string) => {
		setEditing((current) => (current?.id === id ? null : current));
	}, []);

	return {
		discard: () => setEditing(null),
		discardDeleted,
		editing,
		isSaving,
		saveAndClose,
		setEditing,
		start,
		switchEditing,
	};
};
