import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";

const ViewMenuButton = ({ editor }: { editor: Editor }) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ action: "view" });
	return (
		<DropdownMenuRadioGroup value={isActive ? "view" : undefined}>
			<DropdownMenuRadioItem
				disabled={disabled}
				onClick={() => editor.chain().focus().setView({ defs: [] }).run()}
				value="view"
			>
				<div className="flex items-center gap-2">
					<Icon icon="panels-top-left" />
					{t("properties.view.name")}
				</div>
			</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
	);
};

export default ViewMenuButton;
