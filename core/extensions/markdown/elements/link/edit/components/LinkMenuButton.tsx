import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import getSelectedText from "@ext/markdown/elementsUtils/getSelectedText";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";

const LinkMenuButton = ({ editor, onClick }: { editor: Editor; onClick: () => void }) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ mark: "link" });
	const onClickHandler = () => {
		onClick();
		editor.commands.toggleLink({ href: "", target: editor ? getSelectedText(editor.state) : "" });
	};

	return (
		<GlassToolbarToggleButton
			active={isActive}
			data-qa="link-button"
			disabled={disabled}
			hotKey={"Mod-K"}
			onClick={() => onClickHandler()}
			tooltipText={t("link")}
		>
			<GlassToolbarIcon icon={"link"} />
		</GlassToolbarToggleButton>
	);
};

export default LinkMenuButton;
