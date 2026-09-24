import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";

const StrikeMenuButton = ({ editor }: { editor: Editor }) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ mark: "s" });
	return (
		<GlassToolbarToggleButton
			active={isActive}
			data-testid="tb-strikethrough"
			disabled={disabled}
			hotKey={"Mod-Shift-X"}
			onClick={() => editor.chain().focus().toggleStrike().run()}
			tooltipText={t("strike")}
		>
			<GlassToolbarIcon icon={"strikethrough"} />
		</GlassToolbarToggleButton>
	);
};

export default StrikeMenuButton;
