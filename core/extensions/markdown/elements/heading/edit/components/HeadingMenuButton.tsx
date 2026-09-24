import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import t from "@ext/localization/locale/translate";
import type { Level } from "@ext/markdown/elements/heading/edit/model/heading";
import type { Editor } from "@tiptap/core";
import { GlassToolbarIcon, GlassToolbarToggleItem } from "@ui-kit/GlassToolbar";

interface HeadingMenuButtonProps {
	level: Level;
	editor?: Editor;
}

const HeadingMenuButton = ({ level, editor }: HeadingMenuButtonProps) => {
	return (
		<GlassToolbarToggleItem
			active={editor?.isActive("heading", { level })}
			data-testid={`tb-heading-${level}`}
			hotKey={`Mod-Alt-${level}`}
			onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
			tooltipText={`${t("editor.heading")} ${level}`}
			value={level.toString()}
		>
			<GlassToolbarIcon icon={`heading-${level}-custom` as IconCode} />
		</GlassToolbarToggleItem>
	);
};

export default HeadingMenuButton;
