import t from "@ext/localization/locale/translate";
import getSelectedText from "@ext/markdown/elementsUtils/getSelectedText";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { useCallback } from "react";
import { useAgentOpenCatalogPaths } from "../hooks/useAgentOpenCatalogPaths";
import { setAgentChatIsOpen } from "../store/AgentChatIsOpenStore";
import { setQuote } from "../store/ChatStore";

const DiscussInChat = ({ editor }: { editor: Editor }) => {
	const { openCatalogName, openItemPath } = useAgentOpenCatalogPaths();
	const disabled = useEditorState({
		editor,
		selector: ({ editor }) => editor?.state.selection.empty ?? true,
	});

	const onClick = useCallback(() => {
		const text = getSelectedText(editor.state);
		if (!text) return;

		setQuote(
			openCatalogName && openItemPath ? { text, catalogName: openCatalogName, itemPath: openItemPath } : { text },
		);

		setAgentChatIsOpen(true);
	}, [editor, openCatalogName, openItemPath]);

	return (
		<GlassToolbarToggleButton disabled={disabled} onClick={onClick} tooltipText={t("editor.ai.discuss")}>
			<GlassToolbarIcon icon="wand-sparkles" />
		</GlassToolbarToggleButton>
	);
};

export default DiscussInChat;
