import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";

const StrongMenuButton = ({ editor }: { editor: Editor }) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ mark: "strong" });

	return (
		<GlassToolbarToggleButton
			active={isActive}
			data-testid="tb-bold"
			disabled={disabled}
			hotKey={"Mod-B"}
			onClick={() => editor.chain().focus().toggleStrong().run()}
			tooltipText={t("editor.bold")}
		>
			<GlassToolbarIcon icon={"bold"} />
		</GlassToolbarToggleButton>
	);
};

export default StrongMenuButton;
