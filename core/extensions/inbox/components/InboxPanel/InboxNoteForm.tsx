import { MinimizedArticleStyled } from "@components/Article/MiniArticle";
import SpinnerLoader from "@components/Atoms/SpinnerLoader";
import { cn } from "@core-ui/utils/cn";
import SmallEditor from "@ext/inbox/components/Editor/SmallEditor";
import type { InboxDraft } from "@ext/inbox/logic/inboxEditingSession";
import { isInboxDraftEmpty } from "@ext/inbox/logic/inboxEditingSession";
import t from "@ext/localization/locale/translate";
import getArticleWithTitle from "@ext/markdown/elements/article/edit/logic/getArticleWithTitle";
import { Placeholder } from "@ext/markdown/elements/placeholder/placeholder";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@ui-kit/Button";
import { useMemo } from "react";
import { getInboxExtensions } from "./getInboxExtensions";

type InboxNoteFormProps = {
	id: string;
	draft: InboxDraft;
	editTree: JSONContent | null;
	isSaving: boolean;
	onChange: (draft: InboxDraft, editTree: JSONContent) => void;
	onDiscard: () => void;
	onSave: () => void;
};

const getText = (node: JSONContent): string =>
	node.text ?? node.content?.map(getText).join("\n").replace(/\n+/g, "\n").trim() ?? "";

export const InboxNoteForm = ({ id, draft, editTree, isSaving, onChange, onDiscard, onSave }: InboxNoteFormProps) => {
	const extensions = useMemo(
		() => [
			...getInboxExtensions(),
			Placeholder.configure({
				placeholder: ({ editor, node }) =>
					editor.state.doc.firstChild === node
						? t("inbox.placeholders.title")
						: t("inbox.placeholders.content"),
			}),
		],
		[],
	);

	return (
		<div className="relative flex flex-col gap-2 border-y border-secondary-border bg-secondary-bg px-4 py-3">
			{editTree ? (
				<MinimizedArticleStyled>
					<SmallEditor
						articleType="inbox"
						className={cn(
							"text-xs",
							"[&_[data-qa=article-editor]>.ProseMirror>p]:!leading-4",
							"[&_[data-qa=article-editor]>.ProseMirror>*:last-child]:!mb-0",
							"[&_[data-qa=article-editor]>.ProseMirror>p:first-of-type]:!text-sm",
							"[&_[data-qa=article-editor]>.ProseMirror>p:first-of-type]:!font-medium",
						)}
						content={getArticleWithTitle(draft.title, editTree)}
						disableArticleMat
						disableInlineToolbar
						disableToolbar
						extensions={extensions}
						id={id}
						manualSave
						props={{ title: draft.title, content: editTree }}
						updateCallback={(_, content, title) => onChange({ title, content: getText(content) }, content)}
					/>
				</MinimizedArticleStyled>
			) : (
				<SpinnerLoader />
			)}
			<div className="relative z-10 flex justify-end gap-2">
				<Button className="!shadow-none" disabled={isSaving} onClick={onDiscard} size="xs" variant="outline">
					{t("cancel")}
				</Button>
				<Button
					className="!shadow-none"
					disabled={isSaving || isInboxDraftEmpty(draft)}
					onClick={onSave}
					size="xs"
				>
					{t("save")}
				</Button>
			</div>
		</div>
	);
};
