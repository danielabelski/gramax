import EmMenuButton from "@ext/markdown/elements/em/edit/components/EmMenuButton";
import HighlightMenuButton from "@ext/markdown/elements/highlight/edit/components/HighlightMenuButton";
import StrikeMenuButton from "@ext/markdown/elements/strikethrough/edit/components/StrikeMenuButton";
import StrongMenuButton from "@ext/markdown/elements/strong/edit/components/StrongMenuButton";
import { getPluginComponents } from "@plugins/store";
import type { Editor } from "@tiptap/core";
import { GlassToolbarGroup, GlassToolbarSeparator } from "@ui-kit/GlassToolbar";

export interface TextMenuGroupButtons {
	strong?: boolean;
	em?: boolean;
	strike?: boolean;
	highlight?: boolean;
}

interface TextMenuGroupProps {
	editor?: Editor;
	isSelectionMenu?: boolean;
	buttons?: TextMenuGroupButtons;
}

const TextMenuGroup = ({ editor, isSelectionMenu = false, buttons }: TextMenuGroupProps) => {
	const { strong = true, em = true, strike = true, highlight = true } = buttons || {};

	const plugins = getPluginComponents();

	return (
		<>
			{(strong || em || strike) && (
				<GlassToolbarGroup>
					{strong && <StrongMenuButton editor={editor} />}
					{em && <EmMenuButton editor={editor} />}
					{strike && <StrikeMenuButton editor={editor} />}
				</GlassToolbarGroup>
			)}
			{isSelectionMenu && highlight && (
				<>
					<GlassToolbarSeparator variant="inline" />
					<HighlightMenuButton editor={editor} />
				</>
			)}
			{plugins.length > 0 && (
				<GlassToolbarGroup>
					{plugins.map((Component, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: index used as key because the order of plugins is static
						<Component editor={editor} key={index} />
					))}
				</GlassToolbarGroup>
			)}
		</>
	);
};

export default TextMenuGroup;
