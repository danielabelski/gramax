import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import { useAgentChatVisibility } from "@ext/agent/components/hooks/useAgentChatVisibility";
import DiscussInChat from "@ext/agent/components/panel/DiscussInChat";
import TextPrettify from "@ext/ai/components/Buttons/TextPrettify";
import useSupportedElements from "@ext/markdown/core/edit/components/Menu/Groups/hooks/useSupportedElements";
import CodeMenuButton from "@ext/markdown/elements/code/edit/components/CodeMenuButton";
import CommentMenuButton from "@ext/markdown/elements/comment/edit/components/CommentMenuButton";
import { FileMenuButton } from "@ext/markdown/elements/file/edit/components/FileMenuButton";
import FragmentLinkMenuButton from "@ext/markdown/elements/fragment-link/edit/components/FragmentLinkMenuButton";
import LinkMenuButton from "@ext/markdown/elements/link/edit/components/LinkMenuButton";
import type { Editor } from "@tiptap/core";
import { GlassToolbarGroup, GlassToolbarSeparator } from "@ui-kit/GlassToolbar";

export interface InlineMenuGroupButtons {
	link?: boolean;
	file?: boolean;
	code?: boolean;
	comment?: boolean;
	prettify?: boolean;
	discuss?: boolean;
	fragmentLink?: boolean;
}

interface InlineMenuGroupProps {
	editor?: Editor;
	onClick?: () => void;
	buttons?: InlineMenuGroupButtons;
}

const InlineMenuGroup = ({ editor, onClick, buttons }: InlineMenuGroupProps) => {
	const {
		link = true,
		file = true,
		code = true,
		comment = true,
		prettify = true,
		discuss = true,
		fragmentLink = true,
	} = buttons || {};
	const isGramaxAiEnabled = PageDataContext.value?.conf?.ai?.enabled;
	const { showToggle: isAgentChatEnabled } = useAgentChatVisibility();
	const { isCommentSupported } = useSupportedElements();

	const hasDiscuss = isAgentChatEnabled && discuss;
	const hasComment = isCommentSupported && comment;
	const hasPrettify = isGramaxAiEnabled && prettify && !isAgentChatEnabled;
	const isLastGroupAvailable = hasDiscuss || hasComment || hasPrettify;

	return (
		<>
			{(link || code || file || fragmentLink) && (
				<GlassToolbarGroup>
					{link && <LinkMenuButton editor={editor} onClick={onClick} />}
					{code && <CodeMenuButton editor={editor} isInline />}
					{file && <FileMenuButton editor={editor} onSave={onClick} />}
					{fragmentLink && <FragmentLinkMenuButton editor={editor} />}
				</GlassToolbarGroup>
			)}
			{isLastGroupAvailable && (
				<>
					<GlassToolbarSeparator variant="inline" />

					<GlassToolbarGroup>
						{hasDiscuss && <DiscussInChat editor={editor} />}
						{hasComment && <CommentMenuButton editor={editor} />}
						{hasPrettify && <TextPrettify editor={editor} />}
					</GlassToolbarGroup>
				</>
			)}
		</>
	);
};

export default InlineMenuGroup;
