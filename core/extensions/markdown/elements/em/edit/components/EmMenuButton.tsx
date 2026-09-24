import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";

const EmMenuButton = ({ editor }: { editor: Editor }) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ mark: "em" });

	return (
		<GlassToolbarToggleButton
			active={isActive}
			data-testid="tb-italic"
			disabled={disabled}
			hotKey={"Mod-I"}
			onClick={() => editor.chain().focus().toggleItalic().run()}
			tooltipText={t("editor.italic")}
		>
			<GlassToolbarIcon icon={"italic"} />
		</GlassToolbarToggleButton>
	);
};

export default EmMenuButton;
