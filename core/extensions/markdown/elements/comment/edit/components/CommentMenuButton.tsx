import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import t from "@ext/localization/locale/translate";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { memo, useCallback, useEffect, useState } from "react";

const CommentMenuButton = memo(({ editor }: { editor: Editor }) => {
	const [isSelected, setIsSelected] = useState(() => !editor.state.selection.empty);
	const { isActive, disabled } = ButtonStateService.useCurrentAction({ mark: "comment" });
	const pageDataContext = PageDataContextService.value;
	const isStorageConnected = useIsStorageConnected();
	const apiUrlCreator = ApiUrlCreatorService.value;

	useEffect(() => {
		const onSelectionUpdate = ({ editor }: { editor: Editor }) => {
			setIsSelected(!editor.state.selection.empty);
		};

		editor.on("selectionUpdate", onSelectionUpdate);
		return () => {
			editor.off("selectionUpdate", onSelectionUpdate);
		};
	}, [editor]);

	const isButtonDisabled = !isSelected || !pageDataContext.user.info || disabled || !isStorageConnected;
	const tooltipText =
		pageDataContext.user.info && isStorageConnected ? "leave-comment" : "connect-storage-to-leave-comment";

	// biome-ignore lint/correctness/useExhaustiveDependencies: pre-existing dependency list; changing it here would alter behaviour unrelated to this change
	const onClickHandler = useCallback(async () => {
		const res = await FetchService.fetch(apiUrlCreator.getNewCommentId());
		if (!res.ok) return;
		const commentId = await res.text();
		const selection = editor.state.selection;
		if (!selection) return;

		editor.commands.toggleComment({ id: commentId }, { from: selection.from, to: selection.to });
	}, [editor, apiUrlCreator]);

	return (
		<GlassToolbarToggleButton
			active={isActive}
			aria-label={t("leave-comment")}
			data-testid="tb-comment"
			disabled={isButtonDisabled}
			onClick={onClickHandler}
			tooltipText={(!pageDataContext.user.info || !isStorageConnected || !isButtonDisabled) && t(tooltipText)}
		>
			<GlassToolbarIcon icon={"comment"} />
		</GlassToolbarToggleButton>
	);
});

export default CommentMenuButton;
