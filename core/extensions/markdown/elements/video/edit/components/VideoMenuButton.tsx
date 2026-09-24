import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";

const VideoMenuButton = ({ editor }: { editor: Editor }) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ action: "video" });
	return (
		<DropdownMenuRadioGroup value={isActive ? "video" : undefined}>
			<DropdownMenuRadioItem
				disabled={disabled}
				onSelect={() => editor.chain().focus().setVideo().run()}
				value="video"
			>
				<div className="flex flex-row items-center gap-2 w-full" data-qa="qa-edit-menu-video">
					<Icon icon="video" />
					{t("editor.video.name")}
				</div>
			</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
	);
};

export default VideoMenuButton;
