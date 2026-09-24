import type { InboxArticle } from "@ext/inbox/models/types";
import t from "@ext/localization/locale/translate";
import { generateHTML } from "@tiptap/core";
import { Button } from "@ui-kit/Button";
import { CollapsiblePreview } from "@ui-kit/Collapsible";
import { useId, useMemo, useState } from "react";
import { getInboxExtensions } from "./getInboxExtensions";

const hasVisibleContent = (node: InboxArticle["editTree"]): boolean => {
	if (node.text?.trim()) return true;
	if (node.content?.some(hasVisibleContent)) return true;
	return Boolean(node.type && !["doc", "paragraph"].includes(node.type));
};

type InboxNoteContentProps = {
	editTree: InboxArticle["editTree"];
};

export const InboxNoteContent = ({ editTree }: InboxNoteContentProps) => {
	const [expanded, setExpanded] = useState(false);
	const [canExpand, setCanExpand] = useState(false);
	const contentId = useId();
	const renderedContent = useMemo(() => {
		if (!hasVisibleContent(editTree)) return null;
		return {
			// biome-ignore lint/style/useNamingConvention: React's dangerouslySetInnerHTML API requires this property.
			__html: generateHTML(editTree, getInboxExtensions()),
		};
	}, [editTree]);

	return (
		<div>
			<CollapsiblePreview collapsedHeight={32} id={contentId} onCanExpandChange={setCanExpand} open={expanded}>
				{renderedContent ? (
					<div
						className="article text-xs [&_p]:!leading-4 [&>*:last-child]:!mb-0"
						dangerouslySetInnerHTML={renderedContent}
					/>
				) : (
					<div className="article text-xs">{t("inbox.empty-content")}</div>
				)}
			</CollapsiblePreview>
			{canExpand && (
				<Button
					aria-controls={contentId}
					aria-expanded={expanded}
					className="mt-1 h-auto p-0"
					endIcon={expanded ? "chevron-up" : "chevron-down"}
					onClick={() => setExpanded((value) => !value)}
					size="sm"
					variant="text"
				>
					{expanded ? t("inbox.collapse") : t("inbox.expand")}
				</Button>
			)}
		</div>
	);
};
