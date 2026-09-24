import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";

const TabsMenuButton = ({ editor }: { editor: Editor }) => {
	const tabs = ButtonStateService.useCurrentAction({ action: "tabs" });

	return (
		<DropdownMenuRadioGroup value={tabs.isActive ? "tabs" : undefined}>
			<DropdownMenuRadioItem
				disabled={tabs.disabled}
				onClick={() => editor.chain().focus().setTabs().run()}
				value="tabs"
			>
				<div className="flex items-center gap-2 w-full">
					<Icon icon="app-window" />
					{t("editor.tabs.name")}
				</div>
			</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
	);
};

export default TabsMenuButton;
