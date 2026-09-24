export type InboxDraft = {
	title: string;
	content: string;
};

export const isInboxDraftEmpty = ({ title, content }: InboxDraft) =>
	title.trim().length === 0 && content.trim().length === 0;

export const getDraftTransition = (draft: InboxDraft): "close" | "commit" =>
	isInboxDraftEmpty(draft) ? "close" : "commit";
