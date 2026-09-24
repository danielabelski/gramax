import ActionButton from "@components/controls/HoverController/ActionButton";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreator from "@core-ui/ContextServices/ApiUrlCreator";
import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import { getEditorStore } from "@core-ui/stores/EditorStore";
import t from "@ext/localization/locale/translate";
import { useNodeViewContext } from "@ext/markdown/core/element/NodeViewContextableWrapper";
import FloatActions from "@ext/markdown/elements/float/edit/components/FloatActions";
import { type ReactNode, useCallback, useMemo } from "react";

export interface UseDefaultActionsOptions {
	// Button for adding a comment to the node. Need to add node type in Comment extension.
	comment?: boolean;
	// Default delete button.
	delete?: boolean;
	// Button for adding alignment to the node. Need to specify the node type in Float extension.
	float?: boolean;
}

const useDefaultActions = (right: ReactNode, left: ReactNode, options: UseDefaultActionsOptions = {}) => {
	const { editor, deleteNode, node, getPos } = useNodeViewContext();
	const apiUrlCreator = ApiUrlCreator.value;
	const pageDataContext = PageDataContext.value;
	const disabledComment = !pageDataContext.user.info || !getEditorStore().commentEnabled;
	const { comment = false, delete: deleteAction = true, float = false } = options;
	const hasComment = Boolean(node?.attrs?.comment?.id);

	const handleDelete = useCallback(() => {
		deleteNode();
	}, [deleteNode]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: apiUrlCreator comes from context and changes per catalog; dropping it would leave a stale creator in the closure
	const handleAddComment = useCallback(async () => {
		if (!editor || editor.isDestroyed) return;

		const pos = getPos?.();
		if (typeof pos !== "number") return;
		const target = editor.state.doc.nodeAt(pos);
		if (!target) return;

		editor.commands.setNodeSelection(pos);

		const position = { from: pos, to: pos + target.nodeSize };
		const commentId = target.attrs.comment?.id;
		if (commentId) {
			editor.commands.openComment(commentId, position);
			return;
		}

		const res = await FetchService.fetch(apiUrlCreator.getNewCommentId());
		if (!res.ok || editor.isDestroyed) return;

		editor.commands.toggleComment({ id: await res.text() }, position);
	}, [editor, apiUrlCreator, getPos]);

	const memoRight = useMemo(
		() => (
			<>
				{float && <FloatActions editor={editor} getPos={getPos} node={node} />}
				{right}
				{comment && !disabledComment && (
					<ActionButton
						icon={hasComment ? "message-square-text" : "message-square"}
						onClick={handleAddComment}
						tooltipText={hasComment ? t("show-comment") : t("leave-comment")}
					/>
				)}
				{deleteAction && (
					<ActionButton
						dataTestId="action-delete"
						icon="trash"
						onClick={handleDelete}
						tooltipText={t("delete")}
					/>
				)}
			</>
		),
		[
			right,
			handleAddComment,
			handleDelete,
			comment,
			deleteAction,
			disabledComment,
			hasComment,
			editor,
			float,
			getPos,
			node,
		],
	);

	if (!editor.isEditable) return {};
	return {
		Left: left,
		Right: memoRight,
	};
};

export default useDefaultActions;
