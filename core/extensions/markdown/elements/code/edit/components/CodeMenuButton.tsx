import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import { useIsOneNodeSelected } from "@ext/markdown/core/edit/logic/hooks/useIsOneNodeSelected";
import getIsSelected from "@ext/markdown/elementsUtils/getIsSelected";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { memo, useCallback } from "react";

interface CodeMenuButtonProps {
	editor: Editor;
	isInline?: boolean;
}

const CodeMenuButton = ({ editor, isInline = false }: CodeMenuButtonProps) => {
	const isSelected = useIsOneNodeSelected(editor);
	const { disabled: isDisabledCode, isActive: isActiveCode } = ButtonStateService.useCurrentAction(
		isSelected ? { mark: "code" } : { action: "code_block" },
	);

	const toggleCode = useCallback(() => {
		if (isSelected) editor.chain().focus().toggleCode().run();
		else if (getIsSelected(editor.state)) editor.chain().focus().multilineCodeBlock().run();
		else editor.chain().focus().toggleCodeBlock().run();
	}, [isSelected, editor]);

	return (
		<GlassToolbarToggleButton
			active={isActiveCode}
			data-testid="tb-code"
			disabled={isDisabledCode}
			hotKey={isInline && "Mod-L"}
			onClick={toggleCode}
			tooltipText={isSelected ? t("editor.code") : t("editor.code-block")}
		>
			<GlassToolbarIcon icon={"code-xml"} />
		</GlassToolbarToggleButton>
	);
};

export default memo(CodeMenuButton);
