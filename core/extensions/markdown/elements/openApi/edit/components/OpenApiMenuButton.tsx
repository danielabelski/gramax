import ArticlePropsService from "@core-ui/ContextServices/ArticleProps";
import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import { setEditorStore } from "@core-ui/stores/EditorStore";
import t from "@ext/localization/locale/translate";
import createOpenApi from "@ext/markdown/elements/openApi/edit/logic/createOpenApi";
import type { Editor } from "@tiptap/core";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { useCallback } from "react";

const OpenApiMenuButton = ({ editor }: { editor: Editor }) => {
	const articleProps = ArticlePropsService.value;
	const resourceService = ResourceService.value;
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ action: "openapi" });

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	const onSelect = useCallback(() => {
		setEditorStore({ lastUsedDiagramType: "openapi" });
		void createOpenApi(editor, articleProps, resourceService);
	}, [editor, articleProps, resourceService]);

	return (
		<DropdownMenuRadioGroup value={isActive ? "openapi" : undefined}>
			<DropdownMenuRadioItem disabled={disabled} onSelect={onSelect} value="openapi">
				<div className="flex flex-row items-center gap-2" data-qa={`qa-edit-menu-openApi`}>
					<Icon icon="openapi" />
					{t("open-api")}
				</div>
			</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
	);
};

export default OpenApiMenuButton;
